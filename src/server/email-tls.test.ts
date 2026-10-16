// @vitest-environment node
import net from "node:net";
import tls from "node:tls";
import { Duplex } from "node:stream";
import nodemailer from "nodemailer";
import type {
  SMTPTransportOptions,
  SMTPTransportGetSocket,
} from "nodemailer/lib/smtp-transport";
import { afterEach, describe, expect, it, vi } from "vitest";
import identity from "~/test/fixtures/smtp-tls.json";
import { sendAuthEmail, sendOrderNotificationEmail } from "./email";
import type { EmailDeliveryBudget } from "./checkout-email";

const env = vi.hoisted(() => ({
  NODE_ENV: "production",
  EMAIL_DELIVERY_MODE: "smtp",
  APP_URL: "https://store.example.test",
  SMTP_HOST: "smtp.example.invalid",
  SMTP_PORT: 587,
  SMTP_USER: "synthetic-user",
  SMTP_PASSWORD: "synthetic-password",
  SMTP_FROM_EMAIL: "sender@example.test",
  SMTP_FROM_NAME: "Fixture",
  ORDER_NOTIFICATION_EMAIL: "owner@example.test",
}));
vi.mock("~/env", () => ({ env }));

// Two connected memory streams carry real Node TLS records, without TCP/DNS.
function fixture(
  mode: "tls" | "absent" | "refused" | "handshake" | "untrusted",
) {
  const client = new Duplex({
    read() {
      return;
    },
    write(chunk, _encoding, callback) {
      setImmediate(() => {
        server.push(chunk);
        callback();
      });
    },
  });
  const server = new Duplex({
    read() {
      return;
    },
    write(chunk, _encoding, callback) {
      setImmediate(() => {
        client.push(chunk);
        callback();
      });
    },
  });
  Object.assign(client, {
    setTimeout: () => client,
    setKeepAlive: () => client,
  });
  const commands: { text: string; encrypted: boolean }[] = [];
  let secure: tls.TLSSocket | undefined;
  let mime = "";
  let inData = false;
  function listen(stream: Duplex, encrypted: boolean) {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (inData) {
        mime += buffer;
        buffer = "";
        if (mime.endsWith("\r\n.\r\n")) stream.write("250 queued\r\n");
        return;
      }
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n");
        const text = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        commands.push({ text, encrypted });
        if (text.startsWith("EHLO")) {
          stream.write(
            `250-fixture\r\n${!encrypted && mode !== "absent" ? "250-STARTTLS\r\n" : ""}250 AUTH PLAIN\r\n`,
          );
        } else if (text === "STARTTLS") {
          if (mode === "absent" || mode === "refused")
            stream.write("454 TLS unavailable\r\n");
          else {
            stream.removeListener("data", onData);
            stream.write("220 Ready for TLS\r\n");
            if (mode === "handshake") {
              // Invalid TLS records must fail closed before AUTH or DATA.
              stream.once("data", () =>
                stream.write("invalid TLS records\r\n"),
              );
            } else {
              secure = new tls.TLSSocket(server, {
                isServer: true,
                secureContext: tls.createSecureContext(identity),
              });
              secure.on("error", () => undefined);
              listen(secure, true);
            }
          }
        } else if (text.startsWith("AUTH"))
          stream.write("235 authenticated\r\n");
        else if (text === "DATA") {
          inData = true;
          stream.write("354 message\r\n");
        } else stream.write("250 ok\r\n");
      }
    };
    stream.on("data", onData);
  }
  listen(server, false);
  return {
    client,
    commands,
    mime: () => mime,
    greet: () => setImmediate(() => server.write("220 fixture\r\n")),
    close: () => {
      secure?.destroy();
      client.destroy();
      server.destroy();
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("production SMTP encryption", () => {
  it.each(["auth", "checkout"] as const)(
    "%s requires verified STARTTLS before authentication and message delivery",
    async (path) => {
      await exercise(path, "tls");
    },
  );
  it.each(["absent", "refused", "handshake", "untrusted"] as const)(
    "rejects %s STARTTLS for both mail paths before leaking credentials or content",
    async (mode) => {
      for (const path of ["auth", "checkout"] as const)
        await exercise(path, mode);
    },
  );
  it.each([25, 587, 2525, 1025, 465])(
    "applies the shared production policy on port %s",
    async (port) => {
      env.SMTP_PORT = port;
      const transport = nodemailer.createTransport({ streamTransport: true });
      const create = vi
        .spyOn(nodemailer, "createTransport")
        .mockReturnValue(transport);
      try {
        await sendAuthEmail({
          to: "customer@example.test",
          subject: "Fixture",
          text: "Fixture",
          html: "<p>Fixture</p>",
        });
        expect(create).toHaveBeenCalledWith(
          expect.objectContaining({
            secure: port === 465,
            requireTLS: port !== 465,
          }),
        );
      } finally {
        transport.close();
        env.SMTP_PORT = 587;
      }
    },
  );
});

async function exercise(
  path: "auth" | "checkout",
  mode: Parameters<typeof fixture>[0],
) {
  const smtp = fixture(mode);
  const original = nodemailer.createTransport.bind(nodemailer);
  const create = vi
    .spyOn(nodemailer, "createTransport")
    .mockImplementation((options) => {
      if (path === "checkout") return original(options);
      const getSocket: SMTPTransportGetSocket = (_options, callback) => {
        callback(null, { connection: smtp.client as net.Socket });
        smtp.greet();
      };
      return original({
        ...(options as SMTPTransportOptions),
        tls: { ca: identity.cert },
        getSocket,
      });
    });
  const connect = vi.spyOn(net, "createConnection").mockImplementation(() => {
    queueMicrotask(() => {
      smtp.client.emit("connect");
      smtp.greet();
    });
    return smtp.client as net.Socket;
  });
  // Trust only the fixture CA; retain certificate/hostname verification.
  const realTLS = tls.connect;
  let clientTLS: tls.TLSSocket | undefined;
  const tlsConnect = vi
    .spyOn(tls, "connect")
    .mockImplementation((options, callback) => {
      clientTLS = realTLS(
        {
          ...(options as tls.ConnectionOptions),
          ca: mode === "untrusted" ? [] : identity.cert,
        },
        callback as (() => void) | undefined,
      );
      return clientTLS;
    });
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const controller = new AbortController();
  const budget: EmailDeliveryBudget = {
    signal: controller.signal,
    expiresAt: Infinity,
    check: () => controller.signal.throwIfAborted(),
  };
  try {
    const delivery =
      path === "auth"
        ? sendAuthEmail({
            to: "customer@example.test",
            subject: "Fixture",
            text: "synthetic message content",
            html: "<p>synthetic message content</p>",
          })
        : sendOrderNotificationEmail(
            {
              orderId: "fixture",
              totalAmount: "10",
              deliveryAreaKey: "fixture",
              deliveryCity: "fixture",
              customerName: "Fixture",
              customerPhone: "0599123456",
              itemCount: 1,
              createdAt: new Date(0),
            },
            budget,
          );
    if (mode === "tls") {
      await expect(delivery).resolves.toBeUndefined();
      expect(clientTLS?.authorized).toBe(true);
      expect(smtp.commands).toContainEqual({
        text: "STARTTLS",
        encrypted: false,
      });
      for (const prefix of ["AUTH PLAIN", "MAIL FROM:", "RCPT TO:", "DATA"]) {
        expect(
          smtp.commands.some(
            (command) => command.text.startsWith(prefix) && command.encrypted,
          ),
        ).toBe(true);
      }
      expect(smtp.mime()).toContain("Subject:");
    } else {
      await expect(delivery).rejects.toThrow("Email delivery failed.");
      expect(
        smtp.commands.some(({ text }) => /^(AUTH|MAIL|RCPT|DATA)/.test(text)),
      ).toBe(false);
      expect(smtp.mime()).toBe("");
    }
  } finally {
    controller.abort();
    smtp.close();
    create.mockRestore();
    connect.mockRestore();
    tlsConnect.mockRestore();
    log.mockRestore();
  }
}
