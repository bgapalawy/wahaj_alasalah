import jwt from "jsonwebtoken";

/**
 * The critical security fix: before this, NOTHING in the backend
 * checked who was calling — the Admin bulk-import/convert endpoints,
 * villa writes, file uploads, all of it was reachable by anyone who
 * found the URL, with the frontend's confirm() dialogs being the only
 * (non-)obstacle. This middleware requires a valid signed token on
 * every protected request.
 *
 * Deliberately simple for this app's actual scale (a small internal
 * team, one shared password) rather than a full per-user account
 * system — see auth.routes.js for the login endpoint this pairs with.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired or invalid — please log in again." });
  }
}
