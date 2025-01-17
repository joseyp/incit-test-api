require("dotenv").config();

var express = require("express");
var router = express.Router();

const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

const requireJsonContent = (req, res, next) => {
  if (req.headers["content-type"] !== "application/json") {
    return res.status(415).json({
      error: "Content-Type must be application/json",
    });
  }
  next();
};

async function createVerificationToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
}

const sendEmailService = async (to, subject, text) => {
  try {
    // const transporter = nodemailer.createTransport({
    //   service: "Gmail", // Or another service
    //   auth: {
    //     user: process.env.EMAIL_USER, // Your email
    //     pass: process.env.EMAIL_PASS, // Your email password
    //   },
    // });

    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to,
    //   subject,
    //   text,
    // });

    await nodemailer
      .createTransport({
        service: "Gmail", // Or another service
        auth: {
          user: process.env.EMAIL_USER, // Your email
          pass: process.env.EMAIL_PASS, // Your email password
        },
      })
      .sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
      });

    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// const sendVerificationEmail = (userEmail, token) => {
//   const verificationUrl = `${process.env.FRONTEND_URL}/sign-up/verify?token=${token}`;

//   const mailOptions = {
//     from: "incit@email.com",
//     to: userEmail,
//     subject: "Email Verification",
//     text: `Please verify your email by clicking the link: ${verificationUrl}`,
//   };

//   transporter.sendMail(mailOptions, (err, info) => {
//     if (err) {
//       console.error("Error sending email:", err);
//     } else {
//       console.log("Verification email sent:", info.response);
//     }
//   });
// };

async function sendEmailVerification(email, token, res) {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/sign-up/verify?token=${token}`;
    const emailContent = `Click the link to verify your email: ${verificationUrl}`;

    await sendEmailService(email, "Verify your Email", emailContent);
  } catch (error) {
    res.status(500).json({ error: "Error sending email" });
  }
}

router.post("/", requireJsonContent, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { email, password, name } = req.body;

    const existingUser = await client.query(
      "SELECT verified, id FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      if (existingUser.rows[0].verified == true)
        return res.status(400).json({ error: "Email already registered" });

      const verificationToken = await createVerificationToken(
        existingUser.rows[0].id
      );
      sendEmailVerification(email, verificationToken, res);
      return res.status(400).json({
        error: "Please check your email for verification",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, passwordHash, name]
    );

    const userId = userResult.rows[0].id;

    const verificationToken = await createVerificationToken(userId);
    // sendEmailVerification(email, verificationToken, res);

    const verificationUrl = `${process.env.FRONTEND_URL}/sign-up/verify?token=${verificationToken}`;
    const emailContent = `Click the link to verify your email: ${verificationUrl}`;

    await nodemailer
      .createTransport({
        service: "Gmail", // Or another service
        auth: {
          user: process.env.EMAIL_USER, // Your email
          pass: process.env.EMAIL_PASS, // Your email password
        },
      })
      .sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verification Email",
        text: emailContent,
      });

    await client.query("COMMIT");

    res.status(201).json({
      verificationToken,
      user: {
        id: userId,
        email,
        name,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

router.get("/verify-email", requireJsonContent, async (req, res) => {
  const { token } = req.query;
  const client = await pool.connect();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const updatedUser = await client.query(
      `UPDATE users 
       SET verified=true
       WHERE id = $1
       RETURNING id`,
      [userId]
    );

    res
      .status(200)
      .send({ status: "success", message: "Email verified successfully!" });
  } catch (err) {
    console.error("Error verifying email:", err);
    res
      .status(400)
      .send({ status: "failed", message: "Invalid or expired token." });
  } finally {
    client.release();
  }
});

module.exports = router;
