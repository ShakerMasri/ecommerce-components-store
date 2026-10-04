import nodemailer, { type SendMailOptions } from "nodemailer";
import { env } from "~/env";
import { storeConfig } from "~/config/store";
import { buildOrderReceipt, type ReceiptOrder } from "./order-receipt";
import {
  awaitEmailWithinBudget,
  type EmailDeliveryBudget,
} from "./checkout-email";
import { createCheckoutSMTPTransport } from "./checkout-smtp";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: SendMailOptions["attachments"];
};

type SendAuthEmailInput = SendEmailInput;

// Exact allowlists only: provider messages and arbitrary command strings may
// contain credentials, recipients or tokens and must never reach logs.
const diagnosticCodes = new Set([
  "ECONNECTION",
  "ESOCKET",
  "ETIMEOUT",
  "ETIMEDOUT",
  "EAUTH",
  "ETLS",
  "EDNS",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "EENVELOPE",
  "EMESSAGE",
  "ESTREAM",
  "EPROTOCOL",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);
const diagnosticCommands = new Set([
  "CONN",
  "EHLO",
  "HELO",
  "STARTTLS",
  "AUTH",
  "AUTH PLAIN",
  "AUTH LOGIN",
  "AUTH XOAUTH2",
  "MAIL FROM",
  "RCPT TO",
  "DATA",
  "QUIT",
]);

function authEmailFailureDiagnostic(error: unknown) {
  const fields =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  return {
    code:
      typeof fields.code === "string" && diagnosticCodes.has(fields.code)
        ? fields.code
        : "UNKNOWN",
    responseCode:
      typeof fields.responseCode === "number" &&
      Number.isInteger(fields.responseCode) &&
      fields.responseCode >= 100 &&
      fields.responseCode <= 599
        ? fields.responseCode
        : undefined,
    command:
      typeof fields.command === "string" &&
      diagnosticCommands.has(fields.command)
        ? fields.command
        : "UNKNOWN",
  };
}

export type SendOrderNotificationEmailInput = {
  orderId: string;
  totalAmount: string;
  deliveryAreaKey: string;
  deliveryCity: string;
  customerName: string | null;
  customerPhone: string | null;
  itemCount: number;
  createdAt: Date;
};

function isDevelopmentEmailPlaceholder() {
  return (
    env.NODE_ENV !== "production" &&
    (env.SMTP_HOST === "localhost" ||
      env.SMTP_USER === "dev@example.com" ||
      env.SMTP_PASSWORD === "dev-password" ||
      env.SMTP_FROM_EMAIL.endsWith(".test"))
  );
}

function extractUrlFromText(text: string) {
  const urlRegex = /https?:\/\/\S+/;
  const match = urlRegex.exec(text);

  return match?.[0] ?? null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function maskPhone(value: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "Available in admin panel";
  }

  const visibleDigits = trimmedValue.replace(/\D/g, "").slice(-4);

  if (!visibleDigits) {
    return "Available in admin panel";
  }

  return `Ending in ${visibleDigits}`;
}

async function sendEmail(
  { to, subject, text, html, attachments }: SendEmailInput,
  options: {
    logOnlyFirstUrl?: boolean;
    budget?: EmailDeliveryBudget;
    fromEmail?: string;
    diagnoseAuthFailure?: boolean;
  } = {},
) {
  // Fail closed even if a caller supplies an unvalidated environment.
  if (env.NODE_ENV === "production" && env.EMAIL_DELIVERY_MODE !== "smtp") {
    throw new Error("Production email delivery requires SMTP.");
  }

  if (env.EMAIL_DELIVERY_MODE === "log" || isDevelopmentEmailPlaceholder()) {
    const url = options.logOnlyFirstUrl ? extractUrlFromText(text) : null;

    console.warn("\n[EMAIL LOG - NOT SENT]");
    console.warn(`To: ${to}`);
    console.warn(`Subject: ${subject}`);

    if (url) {
      console.warn(`Open this link in your browser:\n${url}`);
    } else {
      console.warn(text);
    }

    console.warn("[END EMAIL LOG]\n");

    return;
  }

  let closeCheckoutTransport: (() => void) | undefined;
  try {
    options.budget?.check();
    const smtpOptions = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    };
    const checkoutTransport = options.budget
      ? createCheckoutSMTPTransport(smtpOptions, options.budget)
      : undefined;
    if (checkoutTransport)
      closeCheckoutTransport = () => checkoutTransport.close?.();
    const transporter = nodemailer.createTransport(
      checkoutTransport ?? smtpOptions,
    );

    const delivery = transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${options.fromEmail ?? env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
      ...(attachments ? { attachments } : {}),
    });
    if (options.budget) await awaitEmailWithinBudget(delivery, options.budget);
    else await delivery;
  } catch (error) {
    // Provider errors can contain credentials or message content. Do not pass
    // the original error (including its cause) to production callers/loggers.
    if (env.NODE_ENV === "production") {
      if (options.diagnoseAuthFailure) {
        console.error(
          "[AUTH EMAIL DELIVERY FAILED]",
          authEmailFailureDiagnostic(error),
        );
      }
      throw new Error("Email delivery failed.");
    }
    throw error;
  } finally {
    closeCheckoutTransport?.();
  }
}

export async function sendAuthEmail(input: SendAuthEmailInput) {
  await sendEmail(input, { logOnlyFirstUrl: true, diagnoseAuthFailure: true });
}

export async function sendCustomerOrderReceiptEmail(
  input: {
    to: string;
    order: ReceiptOrder;
  },
  budget?: EmailDeliveryBudget,
) {
  await sendEmail(
    { to: input.to, ...buildOrderReceipt(input.order) },
    { budget, fromEmail: env.ORDER_RECEIPT_FROM_EMAIL },
  );
}

export async function sendOrderNotificationEmail(
  {
    orderId,
    totalAmount,
    deliveryAreaKey,
    deliveryCity,
    customerName,
    customerPhone,
    itemCount,
    createdAt,
  }: SendOrderNotificationEmailInput,
  budget?: EmailDeliveryBudget,
) {
  if (!env.ORDER_NOTIFICATION_EMAIL) {
    return;
  }

  const adminOrdersUrl = `${env.APP_URL.replace(/\/$/, "")}/admin/orders`;
  const safeCustomerName = customerName?.trim() ?? "Customer";
  const createdAtText = createdAt.toISOString();
  const subject = `New order received - ${storeConfig.name}`;
  const text = [
    `New order received for ${storeConfig.name}.`,
    "",
    `Order ID: ${orderId}`,
    `Created at: ${createdAtText}`,
    `Total: ${totalAmount} ₪`,
    `Items: ${itemCount}`,
    `Delivery area: ${deliveryAreaKey}`,
    `Delivery city: ${deliveryCity}`,
    `Customer: ${safeCustomerName}`,
    `Phone: ${maskPhone(customerPhone)}`,
    "",
    "Open the admin orders page to review the full order details and contact information:",
    adminOrdersUrl,
  ].join("\n");

  const html = `
    <p>New order received for ${escapeHtml(storeConfig.name)}.</p>
    <ul>
      <li><strong>Order ID:</strong> ${escapeHtml(orderId)}</li>
      <li><strong>Created at:</strong> ${escapeHtml(createdAtText)}</li>
      <li><strong>Total:</strong> ${escapeHtml(totalAmount)} ₪</li>
      <li><strong>Items:</strong> ${itemCount}</li>
      <li><strong>Delivery area:</strong> ${escapeHtml(deliveryAreaKey)}</li>
      <li><strong>Delivery city:</strong> ${escapeHtml(deliveryCity)}</li>
      <li><strong>Customer:</strong> ${escapeHtml(safeCustomerName)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(maskPhone(customerPhone))}</li>
    </ul>
    <p>Open the admin orders page to review the full order details and contact information:</p>
    <p><a href="${escapeHtml(adminOrdersUrl)}">View admin orders</a></p>
  `;

  await sendEmail(
    {
      to: env.ORDER_NOTIFICATION_EMAIL,
      subject,
      text,
      html,
    },
    { budget },
  );
}
