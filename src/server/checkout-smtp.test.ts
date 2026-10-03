// @vitest-environment node
import net from "node:net";
import tls from "node:tls";
import SMTPConnection from "nodemailer/lib/smtp-connection";
import nodemailer from "nodemailer";
import { Duplex } from "node:stream";
import { setImmediate as realImmediate } from "node:timers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSMTPTransport,
  createCheckoutSocket,
  CHECKOUT_SMTP_PHASE_TIMEOUTS,
} from "./checkout-smtp";
import type { EmailDeliveryBudget } from "./checkout-email";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function delivery(controller: AbortController): EmailDeliveryBudget {
  return {
    signal: controller.signal,
    expiresAt: Infinity,
    check: () => controller.signal.throwIfAborted(),
  };
}

describe("owned checkout SMTP socket cancellation", () => {
  it("bounds connection setup, cleans its socket, and ignores late connect/error events", async () => {
    vi.useFakeTimers();
    const socket = new net.Socket();
    const create = vi.spyOn(net, "createConnection").mockReturnValue(socket);
    const controller = new AbortController();
    const resource = createCheckoutSocket(delivery(controller));
    const callback = vi.fn();
    resource.getSocket({ host: "smtp.example.invalid", port: 587 }, callback);
    expect(create).toHaveBeenCalledWith({
      host: "smtp.example.invalid",
      port: 587,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(
      CHECKOUT_SMTP_PHASE_TIMEOUTS.connectionTimeout,
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(socket.destroyed).toBe(true);
    socket.emit("connect");
    socket.emit("error", new Error("late"));
    expect(callback).toHaveBeenCalledTimes(1);
    resource.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("destroys a handed-off socket on abort without calling the hook callback twice", () => {
    const socket = new net.Socket();
    vi.spyOn(net, "createConnection").mockReturnValue(socket);
    const controller = new AbortController();
    const resource = createCheckoutSocket(delivery(controller));
    const callback = vi.fn();
    resource.getSocket(
      { host: "smtp.example.invalid", port: 587, secure: false },
      callback,
    );
    socket.emit("connect");
    expect(callback).toHaveBeenCalledWith(null, { connection: socket });
    controller.abort();
    expect(socket.destroyed).toBe(true);
    socket.emit("error", new Error("late TLS/socket error"));
    expect(callback).toHaveBeenCalledTimes(1);
    resource.close();
  });

  it("refuses late transport setup after the shared budget is cancelled", () => {
    const create = vi.spyOn(net, "createConnection");
    const controller = new AbortController();
    controller.abort();
    const resource = createCheckoutSocket(delivery(controller));
    const callback = vi.fn();
    resource.getSocket({ host: "smtp.example.invalid", port: 587 }, callback);
    expect(create).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]![0]).toBeInstanceOf(Error);
    resource.close();
  });

  it.each([465, 587])(
    "stops the SMTP lifecycle and owned wire during an in-memory TLS handshake on port %s",
    async (port) => {
      // TLS wraps this Duplex entirely in memory; no TCP/DNS/provider connection.
      const wire = new Duplex({
        read() {
          return;
        },
        write(chunk: Buffer, _encoding, callback) {
          const command = chunk.toString();
          if (command.startsWith("EHLO"))
            this.push("250-fixture\r\n250 STARTTLS\r\n");
          if (command.startsWith("STARTTLS"))
            this.push("220 Ready for TLS\r\n");
          callback();
        },
      });
      Object.assign(wire, { setTimeout: () => wire, setKeepAlive: () => wire });
      vi.spyOn(net, "createConnection").mockReturnValue(wire as net.Socket);
      const controller = new AbortController();
      const connect = vi.spyOn(SMTPConnection.prototype, "connect");
      const realTLS = tls.connect;
      let secure!: tls.TLSSocket;
      let reachedTLS!: () => void;
      const handshake = new Promise<void>((resolve) => {
        reachedTLS = resolve;
      });
      vi.spyOn(tls, "connect").mockImplementation((options) => {
        secure = realTLS(options);
        reachedTLS();
        return secure;
      });
      const adapter = createCheckoutSMTPTransport(
        { host: "smtp.example.invalid", port, secure: port === 465 },
        delivery(controller),
      );
      const transport = nodemailer.createTransport(adapter);
      const outcome = transport
        .sendMail({
          from: "sender@example.invalid",
          to: "customer@example.invalid",
          text: "fixture",
        })
        .catch((error: unknown) => error);
      wire.emit("connect");
      if (port === 587) realImmediate(() => wire.push("220 fixture\r\n"));
      await handshake;
      try {
        expect(secure).toBeInstanceOf(tls.TLSSocket);
        controller.abort();
        expect(await outcome).toBeInstanceOf(Error);
        await new Promise<void>((resolve) => realImmediate(resolve));
        expect(wire.destroyed).toBe(true);
        if (port === 587)
          expect(connect.mock.contexts[0]).toMatchObject({ destroyed: true });
        else expect(connect).not.toHaveBeenCalled();
        if (port === 465) expect(secure.destroyed).toBe(true);
        else expect(secure.writableEnded).toBe(true);
      } finally {
        secure?.destroy();
        transport.close();
      }
    },
  );

  it("handles synchronous socket creation failure with one callback", () => {
    vi.spyOn(net, "createConnection").mockImplementation(() => {
      throw new Error("socket setup failed");
    });
    const resource = createCheckoutSocket(delivery(new AbortController()));
    const callback = vi.fn();
    resource.getSocket({ host: "smtp.example.invalid", port: 587 }, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    resource.close();
  });

  it("cannot create TLS after cancellation in the former TCP-handoff/deferred-upgrade window", async () => {
    vi.useFakeTimers();
    const wire = new net.Socket();
    const secure = new net.Socket();
    vi.spyOn(net, "createConnection").mockReturnValue(wire);
    const tlsConnect = vi
      .spyOn(tls, "connect")
      .mockReturnValue(secure as tls.TLSSocket);
    const controller = new AbortController();
    const transport = nodemailer.createTransport(
      createCheckoutSMTPTransport(
        { host: "smtp.example.invalid", port: 465, secure: true },
        delivery(controller),
      ),
    );
    const settled = vi.fn();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const outcome = transport.sendMail({
        from: "sender@example.invalid",
        to: "customer@example.invalid",
        text: "fixture",
      });
      const observed = outcome.then(settled, settled);
      wire.emit("connect");
      // No scheduled work has run. Previously this handed TCP to Nodemailer,
      // scheduling its unguarded tls.connect for the next immediate callback.
      const createdBeforeAbort = tlsConnect.mock.calls.length;
      controller.abort();
      await vi.runAllTimersAsync();
      secure.emit("secureConnect");
      secure.emit("error", new Error("late TLS error"));
      wire.emit("connect");
      wire.emit("error", new Error("late TCP error"));
      await observed;
      await new Promise<void>((resolve) => realImmediate(resolve));
      expect(createdBeforeAbort).toBe(1);
      expect(tlsConnect).toHaveBeenCalledTimes(createdBeforeAbort);
      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled.mock.calls[0]![0]).toBeInstanceOf(Error);
      expect(wire.destroyed).toBe(true);
      expect(secure.destroyed).toBe(true);
      expect(unhandled).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      process.off("unhandledRejection", unhandled);
      transport.close();
    }
  });

  it("hands off completed implicit TLS with secured signaling and no deferred second wrapper", async () => {
    vi.useFakeTimers();
    const wire = new net.Socket();
    const secure = new net.Socket();
    vi.spyOn(net, "createConnection").mockReturnValue(wire);
    const tlsConnect = vi
      .spyOn(tls, "connect")
      .mockReturnValue(secure as tls.TLSSocket);
    const connect = vi.spyOn(SMTPConnection.prototype, "connect");
    const controller = new AbortController();
    const transport = nodemailer.createTransport(
      createCheckoutSMTPTransport(
        { host: "smtp.example.invalid", port: 465, secure: true },
        delivery(controller),
      ),
    );
    const outcome = transport
      .sendMail({
        from: "a@example.invalid",
        to: "b@example.invalid",
        text: "x",
      })
      .catch((error: unknown) => error);
    wire.emit("connect");
    expect(connect).not.toHaveBeenCalled();
    expect(tlsConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: wire,
        host: "smtp.example.invalid",
        servername: "smtp.example.invalid",
        rejectUnauthorized: true,
      }),
    );
    secure.emit("secureConnect");
    expect(connect.mock.contexts[0]).toMatchObject({
      options: { connection: secure, secured: true, secure: true },
    });
    // Nodemailer still defers _onConnect; closing in that window must be safe.
    controller.abort();
    await vi.runAllTimersAsync();
    expect(await outcome).toBeInstanceOf(Error);
    expect(tlsConnect).toHaveBeenCalledTimes(1);
    expect(wire.destroyed).toBe(true);
    expect(secure.destroyed).toBe(true);
    expect(connect.mock.contexts[0]).toMatchObject({ destroyed: true });
    expect(vi.getTimerCount()).toBe(0);
    transport.close();
  });

  it("completes port-465 SMTP over the secured handoff and disposes both owned sockets", async () => {
    const wire = new net.Socket();
    let data = false;
    let mime = "";
    const commands: string[] = [];
    // TLS establishment is mocked; the installed SMTP protocol/MIME lifecycle
    // runs over this secured-socket fixture, entirely without external I/O.
    const secure = new Duplex({
      read() {
        return;
      },
      write(chunk: Buffer, _encoding, callback) {
        const command = chunk.toString();
        if (data) {
          mime += command;
          if (mime.endsWith("\r\n.\r\n")) this.push("250 queued\r\n");
        } else {
          commands.push(command);
          if (command.startsWith("EHLO")) this.push("250 fixture\r\n");
          else if (command.startsWith("DATA")) {
            data = true;
            this.push("354 send message\r\n");
          } else this.push("250 ok\r\n");
        }
        callback();
      },
    });
    Object.assign(secure, {
      encrypted: true,
      authorized: true,
      setTimeout: () => secure,
      setKeepAlive: () => secure,
    });
    vi.spyOn(net, "createConnection").mockReturnValue(wire);
    const tlsConnect = vi.spyOn(tls, "connect").mockImplementation(() => {
      queueMicrotask(() => {
        secure.emit("secureConnect");
        realImmediate(() => secure.push("220 fixture\r\n"));
      });
      return secure as tls.TLSSocket;
    });
    const connect = vi.spyOn(SMTPConnection.prototype, "connect");
    const transport = nodemailer.createTransport(
      createCheckoutSMTPTransport(
        { host: "smtp.example.invalid", port: 465, secure: true },
        delivery(new AbortController()),
      ),
    );
    try {
      const outcome = transport.sendMail({
        from: "a@example.invalid",
        to: "b@example.invalid",
        text: "fixture",
      });
      wire.emit("connect");
      expect(await outcome).toMatchObject({ accepted: ["b@example.invalid"] });
      expect(tlsConnect).toHaveBeenCalledTimes(1);
      expect(commands).toContain("MAIL FROM:<a@example.invalid>\r\n");
      expect(mime).toContain("fixture");
      expect(connect.mock.contexts[0]).toMatchObject({
        destroyed: true,
        options: { secured: true, connection: secure },
      });
      expect(wire.destroyed).toBe(true);
      expect(secure.destroyed).toBe(true);
    } finally {
      transport.close();
    }
  });

  it.each([
    { servername: "smtp.example.invalid" },
    {
      servername: "fallback.example.invalid",
      tls: {
        servername: "smtp.example.invalid",
        minVersion: "TLSv1.2" as const,
      },
    },
  ])("preserves explicit SNI for an IP host: %j", (settings) => {
    const wire = new net.Socket();
    const secure = new net.Socket();
    vi.spyOn(net, "createConnection").mockReturnValue(wire);
    const tlsConnect = vi
      .spyOn(tls, "connect")
      .mockReturnValue(secure as tls.TLSSocket);
    const resource = createCheckoutSocket(delivery(new AbortController()));
    resource.getSocket(
      { host: "192.0.2.1", port: 465, secure: true, ...settings },
      vi.fn(),
    );
    wire.emit("connect");
    expect(tlsConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: wire,
        host: "192.0.2.1",
        servername: "smtp.example.invalid",
        rejectUnauthorized: true,
        ...settings.tls,
      }),
    );
    // Node's built-in hostname verifier remains the default.
    expect(tlsConnect.mock.calls[0]![0]).not.toHaveProperty(
      "checkServerIdentity",
    );
    resource.close();
    expect(wire.destroyed).toBe(true);
    expect(secure.destroyed).toBe(true);
  });

  it.each(["certificate", "closed", "timeout", "synchronous"])(
    "cleans implicit TLS setup on %s failure and ignores late callbacks",
    async (failure) => {
      vi.useFakeTimers();
      const wire = new net.Socket();
      const secure = new net.Socket();
      vi.spyOn(net, "createConnection").mockReturnValue(wire);
      vi.spyOn(tls, "connect").mockImplementation(() => {
        if (failure === "synchronous") throw new Error("TLS setup failed");
        return secure as tls.TLSSocket;
      });
      const resource = createCheckoutSocket(delivery(new AbortController()));
      const callback = vi.fn();
      resource.getSocket(
        { host: "smtp.example.invalid", port: 465, secure: true },
        callback,
      );
      wire.emit("connect");
      if (failure === "certificate")
        secure.emit(
          "error",
          Object.assign(new Error("Certificate verification failed"), {
            code: "ERR_TLS_CERT_ALTNAME_INVALID",
          }),
        );
      if (failure === "closed") secure.emit("close");
      if (failure === "timeout")
        await vi.advanceTimersByTimeAsync(
          CHECKOUT_SMTP_PHASE_TIMEOUTS.connectionTimeout,
        );
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0]![0]).toBeInstanceOf(Error);
      expect(wire.destroyed).toBe(true);
      if (failure !== "synchronous") {
        expect(secure.destroyed).toBe(true);
        secure.emit("secureConnect");
        secure.emit("error", new Error("late"));
      } else secure.destroy(); // This fixture was never returned/owned.
      expect(callback).toHaveBeenCalledTimes(1);
      resource.close();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
