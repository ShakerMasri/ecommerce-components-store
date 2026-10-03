import net from "node:net";
import tls from "node:tls";
import type { Readable } from "node:stream";
import type { Transport, SentMessageInfo } from "nodemailer";
import SMTPConnection from "nodemailer/lib/smtp-connection";
import type { SMTPTransportOptions } from "nodemailer/lib/smtp-transport";
import type { SMTPTransportGetSocket } from "nodemailer/lib/smtp-transport";
import type { EmailDeliveryBudget } from "./checkout-email";

export const CHECKOUT_SMTP_PHASE_TIMEOUTS = {
  connectionTimeout: 2_000,
  greetingTimeout: 2_000,
  socketTimeout: 3_000,
};

// Nonpooled SMTPTransport.close() does not close its active SMTPConnection.
// Own TCP and implicit TLS before the supported secured-socket handoff. Letting
// Nodemailer upgrade a preconnected 465 socket defers TLS beyond cancellation.
export function createCheckoutSocket(budget: EmailDeliveryBudget) {
  let socket: net.Socket | undefined;
  let secureSocket: tls.TLSSocket | undefined;
  let closed = false;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let pending: ((error: Error) => void) | undefined;
  const cancel = () => {
    clearTimeout(connectTimer);
    secureSocket?.destroy();
    socket?.destroy();
    pending?.(new Error("Checkout email delivery stopped."));
  };
  budget.signal.addEventListener("abort", cancel, { once: true });
  const getSocket: SMTPTransportGetSocket = (options, callback) => {
    let returned = false;
    const fail = (error: Error) => {
      if (returned) return;
      returned = true;
      clearTimeout(connectTimer);
      pending = undefined;
      secureSocket?.destroy();
      socket?.destroy();
      callback(error);
    };
    try {
      if (closed) throw new Error("Checkout email delivery stopped.");
      budget.check();
      pending = fail;
      socket = net.createConnection({
        host: options.host!,
        port: Number(options.port),
        signal: budget.signal,
      });
      // Keep this listener through teardown to absorb late socket errors. The
      // SMTP connection also observes errors once the hook hands it the socket.
      socket.on("error", fail);
      socket.once("close", () => fail(new Error("SMTP socket closed.")));
      connectTimer = setTimeout(
        () => fail(new Error("SMTP connection timeout.")),
        CHECKOUT_SMTP_PHASE_TIMEOUTS.connectionTimeout,
      );
      socket.once("connect", () => {
        if (returned || budget.signal.aborted) return;
        clearTimeout(connectTimer);
        const handoff = (connection: net.Socket, secured = false) => {
          if (returned) return;
          try {
            budget.check();
          } catch {
            fail(new Error("Checkout email delivery stopped."));
            return;
          }
          returned = true;
          clearTimeout(connectTimer);
          pending = undefined;
          callback(null, { connection, ...(secured ? { secured: true } : {}) });
        };
        if (!(options.secure ?? Number(options.port) === 465)) {
          // Port 587 retains Nodemailer's STARTTLS lifecycle.
          handoff(socket!);
          return;
        }
        try {
          budget.check();
          const host = options.host!;
          secureSocket = tls.connect({
            ...options.tls,
            host,
            socket: socket!,
            servername:
              options.tls?.servername ??
              options.servername ??
              (net.isIP(host) ? undefined : host),
            rejectUnauthorized: true,
          });
          // Keep observers through teardown for late handshake errors/events.
          secureSocket.on("error", fail);
          secureSocket.once("close", () =>
            fail(new Error("SMTP TLS socket closed.")),
          );
          secureSocket.once("secureConnect", () =>
            handoff(secureSocket!, true),
          );
          if (returned || budget.signal.aborted) {
            secureSocket.destroy();
            return;
          }
          connectTimer = setTimeout(
            () => fail(new Error("SMTP TLS connection timeout.")),
            CHECKOUT_SMTP_PHASE_TIMEOUTS.connectionTimeout,
          );
        } catch {
          fail(new Error("Checkout email TLS connection failed."));
        }
      });
    } catch {
      fail(new Error("Checkout email connection failed."));
    }
  };
  return {
    getSocket,
    close: () => {
      closed = true;
      budget.signal.removeEventListener("abort", cancel);
      cancel();
    },
  };
}

// The standard nonpooled transport keeps its SMTPConnection private. This
// checkout-only adapter uses Nodemailer's documented transport/connection APIs
// so cancellation stops protocol timers and MIME streaming as well as TCP/TLS.
export function createCheckoutSMTPTransport(
  options: SMTPTransportOptions,
  budget: EmailDeliveryBudget,
): Transport {
  const resource = createCheckoutSocket(budget);
  let connection: SMTPConnection | undefined;
  let stream: Readable | undefined;
  let closed = false;
  let stopSend: (() => void) | undefined;
  const cleanup = () => {
    budget.signal.removeEventListener("abort", close);
    connection?.close();
    stream?.destroy();
    resource.close();
  };
  function close() {
    if (closed) return;
    closed = true;
    if (stopSend) stopSend();
    else cleanup();
  }
  budget.signal.addEventListener("abort", close, { once: true });
  return {
    name: "checkout-smtp",
    version: "1",
    close,
    send(mail, callback) {
      if (closed || budget.signal.aborted) {
        callback(new Error("Checkout email delivery stopped."));
        return;
      }
      let returned = false;
      const finish = (error: Error | null, info?: SentMessageInfo) => {
        if (returned) return;
        returned = true;
        closed = true;
        stopSend = undefined;
        cleanup();
        callback(error, info);
      };
      stopSend = () => finish(new Error("Checkout email deadline exceeded."));
      resource.getSocket(options, (error, socketOptions) => {
        if (returned) return;
        if (error || !socketOptions) {
          finish(error ?? new Error("SMTP socket unavailable."));
          return;
        }
        try {
          budget.check();
          connection = new SMTPConnection({
            ...options,
            ...CHECKOUT_SMTP_PHASE_TIMEOUTS,
            ...socketOptions,
          });
          // Keep the error observer during teardown to absorb late errors.
          connection.on("error", (error: Error) => finish(error));
          connection.once("end", () =>
            finish(new Error("SMTP connection closed.")),
          );
          connection.connect((error) => {
            if (returned) return;
            if (error) {
              finish(error);
              return;
            }
            const send = () => {
              if (returned) return;
              try {
                budget.check();
                const envelope = mail.message.getEnvelope();
                stream = mail.message.createReadStream();
                stream.on("error", (error: Error) => finish(error));
                connection!.send(envelope, stream, (error, info) =>
                  finish(
                    error,
                    info
                      ? {
                          ...info,
                          envelope,
                          messageId: mail.message.messageId(),
                        }
                      : undefined,
                  ),
                );
              } catch {
                finish(new Error("Checkout email message preparation failed."));
              }
            };
            try {
              if (connection!.allowsAuth && options.auth) {
                connection!.login(options.auth, (error) => {
                  if (returned) return;
                  if (error) finish(error);
                  else send();
                });
              } else send();
            } catch {
              finish(new Error("Checkout email authentication failed."));
            }
          });
        } catch {
          finish(new Error("Checkout email transport failed."));
        }
      });
    },
  };
}
