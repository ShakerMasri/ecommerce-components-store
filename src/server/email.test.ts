// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { betterAuth } from "better-auth";
import "~/lib/auth";
import { sendAuthEmail, sendOrderNotificationEmail } from "./email";

const env = vi.hoisted(() => ({
  NODE_ENV: "production",
  EMAIL_DELIVERY_MODE: "smtp",
  APP_URL: "https://store.example/",
  BETTER_AUTH_URL: "https://store.example",
  BETTER_AUTH_SECRET: "local-test-secret-at-least-32-characters",
  SMTP_HOST: "smtp.example.invalid",
  SMTP_PORT: 587,
  SMTP_USER: "local-test-user",
  SMTP_PASSWORD: "local-test-password",
  SMTP_FROM_EMAIL: "sender@example.com",
  SMTP_FROM_NAME: "R1 Store",
  ORDER_RECEIPT_FROM_EMAIL: undefined as string | undefined,
  ORDER_NOTIFICATION_EMAIL: "orders@example.com",
}));
vi.mock("~/env", () => ({ env }));
vi.mock("~/config/store", () => ({ storeConfig: { name: "R1 Store" } }));
vi.mock("~/lib/prisma", () => ({ prisma: {} }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: vi.fn() }));
vi.mock("better-auth", () => ({ betterAuth: vi.fn() }));

// Capture the real application's callbacks without starting auth or a database.
const options = vi.mocked(betterAuth).mock.calls[0]?.[0];
const verify = options?.emailVerification?.sendVerificationEmail;
const reset = options?.emailAndPassword?.sendResetPassword;
if (!verify || !reset) throw new Error("Expected application email callbacks");

const user = {
  id: "test-user",
  email: "customer@example.com",
  name: "Test customer",
  emailVerified: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};
const order = {
  orderId: "order-123",
  totalAmount: "125.50",
  deliveryAreaKey: "central",
  deliveryCity: "City <North>",
  customerName: " <Customer & Co> ",
  customerPhone: "+970 599 123456",
  itemCount: 2,
  createdAt: new Date("2026-01-02T12:00:00Z"),
};
const verificationUrl =
  "https://store.example/api/auth/verify-email?token=verification-fixture";
const resetUrl = "https://store.example/reset-password?token=reset-fixture";
const messages = [
  {
    name: "verification",
    to: user.email,
    subject: "Verify your R1 Store account",
    url: verificationUrl,
    send: () =>
      verify({ user, url: verificationUrl, token: "verification-fixture" }),
  },
  {
    name: "password reset",
    to: user.email,
    subject: "Reset your R1 Store password",
    url: resetUrl,
    send: () => reset({ user, url: resetUrl, token: "reset-fixture" }),
  },
  {
    name: "order notification",
    to: "orders@example.com",
    subject: "New order received - R1 Store",
    url: "https://store.example/admin/orders",
    send: () => sendOrderNotificationEmail(order),
  },
];

const realCreateTransport = nodemailer.createTransport.bind(nodemailer);
function createLocalTransport() {
  // Nodemailer 10 constructs actual MIME, entirely in memory; no SMTP socket.
  return realCreateTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
}
let transport: ReturnType<typeof createLocalTransport>;
function spyOnSendMail() {
  return vi.spyOn(transport, "sendMail");
}
let sendMail: ReturnType<typeof spyOnSendMail>;

beforeEach(() => {
  vi.clearAllMocks();
  env.NODE_ENV = "production";
  env.EMAIL_DELIVERY_MODE = "smtp";
  env.SMTP_PORT = 587;
  env.SMTP_HOST = "smtp.example.invalid";
  env.ORDER_RECEIPT_FROM_EMAIL = undefined;
  env.ORDER_NOTIFICATION_EMAIL = "orders@example.com";
  transport = createLocalTransport();
  vi.spyOn(nodemailer, "createTransport").mockReturnValue(transport);
  sendMail = spyOnSendMail();
  for (const method of ["log", "warn", "error", "info", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation(() => undefined);
  }
});
afterEach(() => {
  if (env.NODE_ENV === "production") {
    for (const method of ["log", "warn", "error", "info", "debug"] as const) {
      if (method !== "error") expect(console[method]).not.toHaveBeenCalled();
    }
    for (const call of vi.mocked(console.error).mock.calls) {
      expect(call).toEqual([
        "[AUTH EMAIL DELIVERY FAILED]",
        expect.objectContaining({
          code: expect.any(String),
          command: expect.any(String),
        }),
      ]);
      expect(Object.keys(call[1] as object).sort()).toEqual([
        "code",
        "command",
        "responseCode",
      ]);
    }
  }
  transport.close();
  vi.restoreAllMocks();
});

describe("email delivery with Nodemailer", () => {
  it.each(messages)(
    "keeps the configured SMTP sender for $name when a receipt override is present",
    async (message) => {
      env.ORDER_RECEIPT_FROM_EMAIL = "orders@darakit.com";
      await message.send();
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: message.to,
        }),
      );
      const result = await sendMail.mock.results[0]!.value;
      expect(result.envelope.from).toBe(env.SMTP_FROM_EMAIL);
      expect(result.message.toString()).toContain(
        `From: ${env.SMTP_FROM_NAME} <${env.SMTP_FROM_EMAIL}>`,
      );
      expect(result.message.toString()).not.toContain("orders@darakit.com");
    },
  );

  it.each(messages)(
    "constructs and locally delivers $name",
    async (message) => {
      await expect(message.send()).resolves.toBeUndefined();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.invalid",
        port: 587,
        secure: false,
        auth: { user: "local-test-user", pass: "local-test-password" },
      });
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(console.error).not.toHaveBeenCalled();
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"R1 Store" <sender@example.com>',
          to: message.to,
          subject: message.subject,
          text: expect.stringContaining(message.url),
          html: expect.stringContaining(`href="${message.url}"`),
        }),
      );
      const result = await sendMail.mock.results[0]!.value;
      expect(result.envelope).toEqual({
        from: "sender@example.com",
        to: [message.to],
      });
      expect(Buffer.isBuffer(result.message)).toBe(true);
      const mime = result.message.toString();
      expect(mime).toContain(`Subject: ${message.subject}`);
      expect(mime).toContain("multipart/alternative");
      expect(mime).toContain("text/plain");
      expect(mime).toContain("text/html");
    },
  );

  it.each(messages)(
    "rejects safely on production transport failure for $name",
    async (message) => {
      const failure = new Error(
        `${message.url} private body ${env.SMTP_USER} ${env.SMTP_PASSWORD}`,
      );
      vi.spyOn(transport.transporter, "send").mockImplementation(
        (_mail, callback) => callback(failure),
      );
      await expect(message.send()).rejects.toEqual(
        new Error("Email delivery failed."),
      );
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(
        message.name === "order notification" ? 0 : 1,
      );
    },
  );

  it("preserves verification expiry guidance and password-reset wording", async () => {
    await messages[0]!.send();
    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("This link expires in 1 hour."),
        html: expect.stringContaining("Verify email"),
      }),
    );
    await messages[1]!.send();
    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("You requested a password reset."),
        html: expect.stringContaining("Reset password"),
      }),
    );
  });

  it("preserves order details, HTML escaping, and phone masking", async () => {
    await sendOrderNotificationEmail(order);
    const mail = sendMail.mock.calls[0]![0];
    for (const value of [
      "order-123",
      "125.50",
      "Items: 2",
      "central",
      "City <North>",
      "2026-01-02T12:00:00.000Z",
      "Ending in 3456",
    ]) {
      expect(mail.text).toContain(value);
    }
    expect(mail.html).toContain("&lt;Customer &amp; Co&gt;");
    expect(mail.html).toContain("City &lt;North&gt;");
    expect(mail.html).not.toContain("<Customer");
    expect(mail.text).not.toContain(order.customerPhone);
    expect(mail.html).not.toContain(order.customerPhone);
  });

  it("skips order notifications when no recipient is configured", async () => {
    env.ORDER_NOTIFICATION_EMAIL = "";
    await sendOrderNotificationEmail(order);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("preserves implicit TLS on port 465", async () => {
    env.SMTP_PORT = 465;
    await messages[0]!.send();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, port: 465 }),
    );
  });

  it("uses the STARTTLS-capable non-implicit transport for port 2525", async () => {
    env.SMTP_PORT = 2525;
    await messages[0]!.send();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: false,
        port: 2525,
      }),
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(messages.slice(0, 2))(
    "logs only safe SMTP fields for $name",
    async (message) => {
      const failure = Object.assign(
        new Error(`${message.url} ${env.SMTP_PASSWORD}`),
        {
          code: "EAUTH",
          responseCode: 535,
          command: "AUTH PLAIN",
          response: `${env.SMTP_USER} ${user.email} ${message.url}`,
        },
      );
      sendMail.mockRejectedValue(failure);
      await expect(message.send()).rejects.toEqual(
        new Error("Email delivery failed."),
      );
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        "[AUTH EMAIL DELIVERY FAILED]",
        {
          code: "EAUTH",
          responseCode: 535,
          command: "AUTH PLAIN",
        },
      );
    },
  );

  it.each([
    { code: "ETIMEOUT", command: "CONN" },
    { code: "ESOCKET", command: "CONN" },
    { code: "ETLS", command: "STARTTLS" },
  ])("retains the allowlisted $code/$command stage", async (fields) => {
    sendMail.mockRejectedValue(
      Object.assign(new Error("Private provider text"), fields),
    );
    await expect(messages[0]!.send()).rejects.toThrow("Email delivery failed.");
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "[AUTH EMAIL DELIVERY FAILED]",
      {
        ...fields,
        responseCode: undefined,
      },
    );
  });

  it.each([
    {
      code: verificationUrl,
      responseCode: "535",
      command: `AUTH ${env.SMTP_PASSWORD}`,
    },
    {
      code: "UNRECOGNIZED",
      responseCode: 600,
      command: `RCPT TO:<${user.email}>`,
    },
    { code: "EAUTH", responseCode: 535.5, command: resetUrl },
  ])("rejects unsafe or malformed diagnostic fields %#", async (fields) => {
    sendMail.mockRejectedValue(
      Object.assign(new Error(verificationUrl), fields),
    );
    await expect(messages[0]!.send()).rejects.toThrow("Email delivery failed.");
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "[AUTH EMAIL DELIVERY FAILED]",
      {
        code: fields.code === "EAUTH" ? "EAUTH" : "UNKNOWN",
        responseCode: undefined,
        command: "UNKNOWN",
      },
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      user.email,
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      verificationUrl,
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      env.SMTP_PASSWORD,
    );
  });

  it.each(messages)(
    "rejects production log delivery for $name",
    async (message) => {
      env.EMAIL_DELIVERY_MODE = "log";
      await expect(message.send()).rejects.toThrow(
        "Production email delivery requires SMTP.",
      );
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    },
  );

  it("sanitizes synchronous transport setup failures without an error cause", async () => {
    vi.mocked(nodemailer.createTransport).mockImplementation(() => {
      throw new Error(`${env.SMTP_PASSWORD} ${verificationUrl}`);
    });
    const error: unknown = await messages[0]!
      .send()
      .catch((value: unknown) => value);
    expect(error).toEqual(new Error("Email delivery failed."));
    expect(error).not.toHaveProperty("cause");
  });

  it("does not use the development placeholder fallback in production", async () => {
    env.SMTP_HOST = "localhost";
    await messages[0]!.send();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it.each(["development", "test"])(
    "preserves %s transport errors",
    async (mode) => {
      env.NODE_ENV = mode;
      const failure = new Error("Local transport failure");
      sendMail.mockRejectedValue(failure);
      await expect(messages[0]!.send()).rejects.toBe(failure);
    },
  );

  it.each(["development", "test"])(
    "preserves explicit %s log delivery without transport",
    async (mode) => {
      env.NODE_ENV = mode;
      env.EMAIL_DELIVERY_MODE = "log";
      const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      await sendAuthEmail({
        to: user.email,
        subject: "Test",
        text: "Open https://store.example/local-fixture",
        html: "<p>Test</p>",
      });
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        "Open this link in your browser:\nhttps://store.example/local-fixture",
      );
    },
  );

  it.each(["development", "test"])(
    "preserves %s placeholder logging",
    async (mode) => {
      env.NODE_ENV = mode;
      env.SMTP_HOST = "localhost";
      await messages[0]!.send();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        `Open this link in your browser:\n${verificationUrl}`,
      );
    },
  );
});
