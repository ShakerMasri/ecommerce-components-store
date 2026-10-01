// @vitest-environment node
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("R6 disposable tooling safeguards", () => {
  it.each(["", "no"])(
    "refuses migration configuration without explicit disposable opt-in '%s'",
    async (flag) => {
      vi.resetModules();
      vi.stubEnv(
        "R6_TEST_DATABASE_URL",
        "postgresql://synthetic:synthetic@localhost:5432/r6",
      );
      vi.stubEnv("R6_TEST_DATABASE_DISPOSABLE", flag);
      await expect(import("../../prisma/r6-disposable.config")).rejects.toThrow(
        "explicitly confirmed disposable",
      );
    },
  );
  it("pins both schema URLs to the explicit disposable URL without .env fallback", async () => {
    vi.resetModules();
    const url = "postgresql://synthetic:synthetic@localhost:5432/r6";
    vi.stubEnv("R6_TEST_DATABASE_URL", url);
    vi.stubEnv("R6_TEST_DATABASE_DISPOSABLE", "yes");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://synthetic:synthetic@localhost:5432/other",
    );
    vi.stubEnv(
      "DIRECT_URL",
      "postgresql://synthetic:synthetic@localhost:5432/other",
    );
    const config = (await import("../../prisma/r6-disposable.config")).default;
    if (config.engine !== "classic")
      throw new Error("Expected the classic Prisma engine");
    expect(config.datasource?.url).toBe(url);
    expect(process.env.DATABASE_URL).toBe(url);
    expect(process.env.DIRECT_URL).toBe(url);
  });
  it("refuses even --apply before constructing a client when no target is confirmed", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/backfill-neutral-options.mjs", "--apply"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          R6_TEST_DATABASE_URL: "",
          R6_TEST_DATABASE_DISPOSABLE: "",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "An explicitly confirmed disposable R6 target is required.",
    );
  });
});
