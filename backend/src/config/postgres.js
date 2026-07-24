import pg from "pg";

// This file only ever runs on the server, same as config/aws.js — the
// connection string (with its embedded password) never reaches the
// browser bundle.
//
// Neon requires SSL; `sslmode=require` in the connection string handles
// this for most setups, but `ssl: { rejectUnauthorized: false }` is kept
// here too as a fallback for environments where the driver doesn't pick
// that up from the URL alone (matches Neon's own connection docs).
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set — Postgres-backed services will fail. " +
      "Copy the connection string from your Neon project dashboard into backend/.env."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Thin query helper so services can `import { query } from "./postgres.js"`
 * instead of importing `pool` everywhere — keeps the door open to add
 * query logging/timing here later without touching every call site.
 */
export async function query(text, params) {
  return pool.query(text, params);
}
