/**
 * Creates a new user, or resets an existing one's password.
 *
 *   node scripts/create-user.js <username> <password>
 *
 * There's no signup page on purpose — this is a small internal team
 * tool, not a public app, so accounts are created by whoever manages
 * the deployment, not by users themselves.
 */
import "dotenv/config";
import { createOrUpdateUser } from "../src/services/authService.js";
import { pool } from "../src/config/postgres.js";

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error("Usage: node scripts/create-user.js <username> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password should be at least 8 characters.");
  process.exit(1);
}

await createOrUpdateUser(username, password);
console.log(`User "${username}" created/updated.`);
await pool.end();
