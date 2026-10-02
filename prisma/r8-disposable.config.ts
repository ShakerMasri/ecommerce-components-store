import { defineConfig } from "prisma/config";

// No application environment-file or URL fallback. Only the owner-approved R8
// target may be initialized by this config; both Prisma URLs stay child-local.
const url = process.env.R8_TEST_DATABASE_URL;
if (!url || process.env.R8_TEST_DATABASE_DISPOSABLE !== "yes") {
  throw new Error("An explicitly confirmed disposable R8 target is required.");
}
const target = new URL(url);
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  target.hostname !== "127.0.0.1" ||
  target.port !== "5437" ||
  target.pathname !== "/components_r8_cart_races_20261002" ||
  [...target.searchParams.keys()].some((key) => key !== "schema") ||
  (target.searchParams.has("schema") &&
    target.searchParams.get("schema") !== "public")
) {
  throw new Error("R8 target must match the exact owner-approved database.");
}
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;

export default defineConfig({
  engine: "classic",
  schema: "schema.prisma",
  migrations: { path: "migrations" },
  datasource: { url },
});
