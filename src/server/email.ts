import nodemailer from "nodemailer";
import { env } from "~/env";
import { storeConfig } from "~/config/store";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SendAuthEmailInput = SendEmailInput;

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
  { to, subject, text, html }: SendEmailInput,
  options: { logOnlyFirstUrl?: boolean } = {},
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

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    // Provider errors can contain credentials or message content. Do not pass
    // the original error (including its cause) to production callers/loggers.
    if (env.NODE_ENV === "production") {
      throw new Error("Email delivery failed.");
    }
    throw error;
  }
}

export async function sendAuthEmail(input: SendAuthEmailInput) {
  await sendEmail(input, { logOnlyFirstUrl: true });
}

export async function sendOrderNotificationEmail({
  orderId,
  totalAmount,
  deliveryAreaKey,
  deliveryCity,
  customerName,
  customerPhone,
  itemCount,
  createdAt,
}: SendOrderNotificationEmailInput) {
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

  await sendEmail({
    to: env.ORDER_NOTIFICATION_EMAIL,
    subject,
    text,
    html,
  });
}
