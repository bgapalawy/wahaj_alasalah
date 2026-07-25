import { Router } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { verifyUser } from "../services/authService.js";

export const authRouter = Router();

// Deliberately strict — this is the one endpoint most worth protecting
// against brute-forcing, since it's the entire gate for everything else.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many login attempts. Try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    const user = await verifyUser(username, password);
    if (!user) {
      // Deliberately the same message whether the username doesn't
      // exist or the password is wrong — distinguishing the two lets
      // an attacker enumerate valid usernames.
      return res.status(401).json({ error: "Incorrect username or password." });
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: user.username });
  } catch (err) {
    next(err);
  }
});
