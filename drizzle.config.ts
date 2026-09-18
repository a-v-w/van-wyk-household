import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local and .env on its own; drizzle-kit does not, so do it here.
config({ path: [".env.local", ".env"], override: false, quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see .env.example).");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
