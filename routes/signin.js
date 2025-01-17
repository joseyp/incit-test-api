require("dotenv").config();

var express = require("express");
var router = express.Router();

const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

async function createSession(userId, client) {
  const sessionId = uuidv4();
  const token = jwt.sign({ sessionId, userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await client.query(
    `INSERT INTO sessions (id, user_id, token, expires_at) 
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, token, expiresAt]
  );

  return token;
}

async function recordLogin(userId, ip, userAgent, client) {
  await client.query(
    `INSERT INTO login_history (user_id, ip_address, user_agent) 
     VALUES ($1, $2, $3)`,
    [userId, ip, userAgent]
  );
}

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { email, password } = req.body;

    const userResult = await client.query(
      `SELECT id, email, name, password_hash 
       FROM users 
       WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = await createSession(user.id, client);

    await recordLogin(user.id, req.ip, req.headers["user-agent"], client);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

router.post("/logout", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query(
      `UPDATE login_history
       SET logged_out_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       AND logged_out_at IS NULL`,
      [req.user.userId]
    );

    await client.query(
      "DELETE FROM sessions WHERE user_id = $1 AND token = $2",
      [req.user.userId, req.headers.authorization.split(" ")[1]]
    );

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
