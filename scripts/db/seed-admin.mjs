#!/usr/bin/env node
/**
 * Creates the household and its admin account. Run it once locally and once
 * against production; it is safe to re-run, and updates the password when the
 * account already exists.
 *
 *   node scripts/db/seed-admin.mjs
 *
 * Reads ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD and HOUSEHOLD_NAME from the
 * environment or .env.local, and prompts for anything missing.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: [".env.local", ".env"], override: false, quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed] DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

async function ask(question, fallback) {
  if (fallback) return fallback;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer;
  } finally {
    rl.close();
  }
}

const householdName = await ask(
  "Household name: ",
  process.env.HOUSEHOLD_NAME,
);
const name = await ask("Your name: ", process.env.ADMIN_NAME);
const email = (await ask("Your email: ", process.env.ADMIN_EMAIL))
  .trim()
  .toLowerCase();
const password = await ask("Password (8+ chars): ", process.env.ADMIN_PASSWORD);

if (!householdName || !name || !email || !password) {
  console.error("[seed] Every field is required.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("[seed] The password must be at least 8 characters.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

try {
  const passwordHash = await bcrypt.hash(password, 10);

  const existingUser = await pool.query(
    "select id, household_id from users where email = $1",
    [email],
  );

  if (existingUser.rowCount > 0) {
    await pool.query(
      "update users set name = $1, password_hash = $2, role = 'admin' where id = $3",
      [name, passwordHash, existingUser.rows[0].id],
    );
    await pool.query("update households set name = $1 where id = $2", [
      householdName,
      existingUser.rows[0].household_id,
    ]);
    console.log(`[seed] Updated the admin account for ${email}.`);
  } else {
    const existingHousehold = await pool.query(
      "select id from households order by id limit 1",
    );

    const householdId =
      existingHousehold.rowCount > 0
        ? existingHousehold.rows[0].id
        : (
            await pool.query(
              "insert into households (name) values ($1) returning id",
              [householdName],
            )
          ).rows[0].id;

    if (existingHousehold.rowCount > 0) {
      await pool.query("update households set name = $1 where id = $2", [
        householdName,
        householdId,
      ]);
    }

    await pool.query(
      "insert into users (household_id, name, email, password_hash, role) values ($1, $2, $3, $4, 'admin')",
      [householdId, name, email, passwordHash],
    );
    console.log(`[seed] Created the admin account for ${email}.`);
  }

  console.log("[seed] Sign in, then add the person who works with you from Settings.");
} catch (error) {
  console.error(`[seed] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
