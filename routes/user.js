var express = require("express");
var router = express.Router();

const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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

router.post("/name", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { name } = req.body;

    const updatedUser = await client.query(
      `UPDATE users
     SET name=$1
     WHERE id = $2
     RETURNING *`,
      [name, req.user.userId]
    );

    res.json({
      success: true,
      message: "Name updated successfully",
    });
  } catch (err) {
    console.error("Error updating name:", err);
    res.status(400).send({ status: "failed", message: "Something wrong." });
  } finally {
    client.release();
  }
});

router.post("/reset-password", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const userResult = await client.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.userId]
    );

    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!validPassword)
      return res.status(401).json({ error: "Invalid credentials" });

    if (newPassword != confirmPassword)
      return res.status(401).json({ error: "New password don't match" });

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const updatedUser = await client.query(
      `UPDATE users 
       SET password_hash=$1
       WHERE id = $2
       RETURNING id`,
      [passwordHash, req.user.userId]
    );

    res.json({
      success: true,
      message: "Password updated",
    });
  } catch (err) {
    console.error("Error reset password:", err);
    res.status(400).send({ status: "failed", message: "Something wrong." });
  } finally {
    client.release();
  }
});

module.exports = router;
