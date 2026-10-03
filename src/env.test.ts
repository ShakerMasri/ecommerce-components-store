// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only synthetic configuration; importing the schema never connects to services.
const configuration = {
  NODE_ENV: "production",
  SKIP_ENV_VALIDATION: "",
  BETTER_AUTH_SECRET: "r3-placeholder-secret-at-least-32-characters",
  BETTER_AUTH_URL: "https://store.example.invalid",
  APP_URL: "https://store.example.invalid",
  DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/r3",
  DIRECT_URL: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  EMAIL_DELIVERY_MODE: "smtp",
  SMTP_HOST: "smtp.example.invalid",
  SMTP_PORT: "587",
  SMTP_USER: "r3-placeholder-user",
  SMTP_PASSWORD: "r3-placeholder-password",
  SMTP_FROM_EMAIL: "sender@example.invalid",
  SMTP_FROM_NAME: "R3 placeholder",
  ORDER_RECEIPT_FROM_EMAIL: "",
  ORDER_NOTIFICATION_EMAIL: "",
  UPSTASH_REDIS_REST_URL: "https://redis.example.invalid",
  UPSTASH_REDIS_REST_TOKEN: "r3-placeholder-token",
  CLOUDINARY_CLOUD_NAME: "r3-placeholder",
  CLOUDINARY_API_KEY: "r3-placeholder-key",
  CLOUDINARY_API_SECRET: "r3-placeholder-secret",
};

beforeEach(() => {
  vi.resetModules();
  for (const [key, value] of Object.entries(configuration))
    vi.stubEnv(key, value);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function expectInvalid(field: string) {
  await expect(import("./env.js")).rejects.toThrow(
    "Invalid environment variables",
  );
  expect(console.error).toHaveBeenCalledWith(
    expect.any(String),
    expect.arrayContaining([expect.objectContaining({ path: [field] })]),
  );
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    configuration.SMTP_PASSWORD,
  );
}

describe("production email environment validation", () => {
  it("accepts a separate customer receipt sender without changing the SMTP sender", async () => {
    vi.stubEnv("ORDER_RECEIPT_FROM_EMAIL", "orders@darakit.com");
    const { env } = await import("./env.js");
    expect(env.ORDER_RECEIPT_FROM_EMAIL).toBe("orders@darakit.com");
    expect(env.SMTP_FROM_EMAIL).toBe(configuration.SMTP_FROM_EMAIL);
  });

  it.each([undefined, ""])(
    "permits an absent/empty receipt sender (%s) for SMTP fallback",
    async (value) => {
      vi.stubEnv("ORDER_RECEIPT_FROM_EMAIL", value);
      const { env } = await import("./env.js");
      expect(env.ORDER_RECEIPT_FROM_EMAIL).toBeUndefined();
      expect(env.SMTP_FROM_EMAIL).toBe(configuration.SMTP_FROM_EMAIL);
    },
  );

  it.each([
    "invalid",
    "   ",
    '"DaraKit" <orders@darakit.com>',
    "orders@darakit.com\r\nBcc: other@example.invalid",
  ])("rejects an invalid receipt sender (%j)", async (value) => {
    vi.stubEnv("ORDER_RECEIPT_FROM_EMAIL", value);
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    await expectInvalid("ORDER_RECEIPT_FROM_EMAIL");
  });

  it.each(["", "1"])(
    "rejects production log mode with skip flag '%s'",
    async (skip) => {
      vi.stubEnv("EMAIL_DELIVERY_MODE", "log");
      vi.stubEnv("SKIP_ENV_VALIDATION", skip);
      await expectInvalid("EMAIL_DELIVERY_MODE");
    },
  );

  it.each([
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
    "SMTP_FROM_NAME",
  ])("requires %s", async (field) => {
    vi.stubEnv(field, "");
    await expectInvalid(field);
  });

  it.each([
    ["SMTP_HOST", "   "],
    ["SMTP_USER", "   "],
    ["SMTP_FROM_NAME", "   "],
    ["SMTP_PORT", "0"],
    ["SMTP_PORT", "65536"],
    ["SMTP_PORT", "1.5"],
    ["SMTP_PORT", "invalid"],
    ["SMTP_FROM_EMAIL", "invalid"],
  ])("rejects invalid %s (%s)", async (field, value) => {
    vi.stubEnv(field, value);
    await expectInvalid(field);
  });

  it.each(["smtp", undefined])(
    "accepts valid production SMTP with mode %s",
    async (mode) => {
      vi.stubEnv("EMAIL_DELIVERY_MODE", mode);
      const { env } = await import("./env.js");
      expect(env.EMAIL_DELIVERY_MODE).toBe("smtp");
      expect(env.SMTP_PORT).toBe(587);
    },
  );

  it.each(["development", "test"])(
    "permits explicit log mode in %s",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("EMAIL_DELIVERY_MODE", "log");
      const { env } = await import("./env.js");
      expect(env.EMAIL_DELIVERY_MODE).toBe("log");
    },
  );
});
