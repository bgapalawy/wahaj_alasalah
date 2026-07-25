import bcrypt from "bcryptjs";
import { query } from "../config/postgres.js";

/**
 * Replaces the single shared APP_PASSWORD with real per-user accounts —
 * each person gets their own username/password, hashed with bcrypt
 * (never stored or compared as plaintext). Deliberately still simple —
 * no roles/permissions yet, every logged-in user has the same access —
 * but this is the real foundation for adding that later without another
 * rework, since routes/UI already key off "is this request
 * authenticated" rather than "does the password match."
 */
export async function verifyUser(username, password) {
  if (!username || !password) return null;
  const { rows } = await query("SELECT id, username, password_hash FROM users WHERE username = $1", [username]);
  const user = rows[0];
  if (!user) return null;
  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return null;
  return { id: user.id, username: user.username };
}

export async function createOrUpdateUser(username, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, passwordHash]
  );
}
