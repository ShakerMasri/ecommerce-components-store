import { defineConfig } from "prisma/config";

// Intentionally no dotenv, DATABASE_URL or DIRECT_URL fallback.
const url = process.env.R6_TEST_DATABASE_URL;
if (!url || process.env.R6_TEST_DATABASE_DISPOSABLE !== "yes") {
  throw new Error("An explicitly confirmed disposable R6 target is required.");
}

// The v6 schema also declares these environment names. Resolve both exclusively
// to the confirmed target, even if the operator shell contains application URLs.
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;

export default defineConfig({
  engine: "classic",
  schema: "schema.prisma",
  migrations: { path: "migrations" },
  datasource: { url },
});
