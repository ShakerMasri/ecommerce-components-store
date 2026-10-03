import type { Order, OrderItem } from "@prisma/client";
import { contactConfig } from "~/config/contact";
import { storeConfig } from "~/config/store";
import logo from "./assets/darakit-logo.json";

// Only persisted snapshots enter the receipt; no live product/variant relation.
export type ReceiptOrder = Pick<
  Order,
  | "id"
  | "createdAt"
  | "totalAmount"
  | "deliveryPrice"
  | "deliveryAreaKey"
  | "deliveryCity"
> & {
  items: Pick<
    OrderItem,
    | "quantity"
    | "priceAtPurchase"
    | "subtotalAmount"
    | "productNameAtPurchase"
    | "selectedOptionLabel"
    | "selectedSizeLabel"
    | "selectedColorLabel"
  >[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const ltr = (value: string) =>
  `<span dir="ltr" style="display:inline-block;unicode-bidi:isolate;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</span>`;
const label = (value: string) =>
  `<span dir="auto" style="unicode-bidi:isolate;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</span>`;
const plainLtr = (value: string) => `\u2066${value}\u2069`;
const money = (value: Order["totalAmount"]) => `${value.toFixed(2)} شيكل`;
const logoCid = "darakit-logo@darakit.com";

function nonBlank(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function buildOrderReceipt(order: ReceiptOrder) {
  const brand = `${storeConfig.locales.ar.name} / ${storeConfig.name}`;
  const date = new Intl.DateTimeFormat("ar-PS-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hebron",
  }).format(order.createdAt);
  const collection = order.deliveryAreaKey === "nablus_receive_point";
  const fulfillment = collection
    ? "استلام من نقطة في نابلس بترتيب مسبق عبر واتساب."
    : `التوصيل إلى: ${nonBlank(order.deliveryCity) ?? "المدينة المحددة في الطلب"}`;
  const feeLabel = collection ? "رسوم الاستلام" : "رسوم التوصيل";
  const priceNote = "أسعار الوحدات نهائية وتشمل أي خصم مطبق عند الطلب.";
  const items = order.items.map((item) => ({
    ...item,
    name: nonBlank(item.productNameAtPurchase) ?? "منتج",
    option:
      nonBlank(item.selectedOptionLabel) ??
      [item.selectedSizeLabel, item.selectedColorLabel]
        .map(nonBlank)
        .filter(Boolean)
        .join(" / "),
  }));
  const text = [
    brand,
    "ملخص الطلب",
    "",
    `رقم الطلب: ${plainLtr(order.id)}`,
    `التاريخ: ${date}`,
    "",
    ...items.flatMap((item) => [
      `${item.name}${item.option ? ` — ${item.option}` : ""}`,
      `الكمية: ${plainLtr(String(item.quantity))} | سعر الوحدة: ${plainLtr(money(item.priceAtPurchase))} | المجموع: ${plainLtr(money(item.subtotalAmount))}`,
    ]),
    priceNote,
    "",
    fulfillment,
    `${feeLabel}: ${plainLtr(money(order.deliveryPrice))}`,
    `إجمالي المبلغ المستحق: ${plainLtr(money(order.totalAmount))}`,
    "الدفع نقدًا عند الاستلام.",
    "",
    `الدعم: ${plainLtr(contactConfig.email.address)}`,
    `الهاتف: ${plainLtr(contactConfig.phone.display)}`,
    `واتساب: ${plainLtr(contactConfig.whatsapp.display)} — ${plainLtr(contactConfig.whatsapp.href)}`,
  ].join("\n");
  const rows = items
    .map(
      (item) => `<tr><td style="padding:16px 0;border-bottom:1px solid #e5e7eb">
    <strong>${label(item.name)}</strong>${item.option ? `<div style="color:#4b5563">الخيار: ${label(item.option)}</div>` : ""}
    <div style="margin-top:6px">الكمية: ${ltr(String(item.quantity))} · سعر الوحدة: ${ltr(money(item.priceAtPurchase))}</div>
    <div>المجموع: ${ltr(money(item.subtotalAmount))}</div>
  </td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ملخص الطلب</title></head>
  <body dir="rtl" style="margin:0;padding:16px 8px;background:#f3f4f6;color:#1d2532;font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.8;text-align:right">
  <table role="presentation" dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px"><tr><td style="padding:24px 20px">
    <img src="cid:${logoCid}" width="220" alt="${escapeHtml(brand)}" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto 12px">
    <p style="margin:0;text-align:center">${escapeHtml(storeConfig.locales.ar.name)} / ${ltr(storeConfig.name)}</p>
    <h1 style="font-size:24px;margin:16px 0 8px">ملخص الطلب</h1>
    <p style="margin:0">رقم الطلب: ${ltr(order.id)}<br>التاريخ: ${escapeHtml(date)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;text-align:right">${rows}</table>
    <p style="font-size:14px;color:#4b5563">${priceNote}</p>
    <p>${label(fulfillment)}<br>${feeLabel}: ${ltr(money(order.deliveryPrice))}</p>
    <p style="font-size:20px;font-weight:bold">إجمالي المبلغ المستحق: ${ltr(money(order.totalAmount))}</p>
    <p style="padding:12px;background:#e9f8f7;border-radius:8px;font-weight:bold">الدفع نقدًا عند الاستلام.</p>
    <p style="margin-bottom:0;font-size:14px">الدعم: <a href="${escapeHtml(contactConfig.email.href)}" style="color:#1d2532">${ltr(contactConfig.email.address)}</a><br>
    الهاتف: <a href="${escapeHtml(contactConfig.phone.href)}" style="color:#1d2532">${ltr(contactConfig.phone.display)}</a><br>
    واتساب: <a href="${escapeHtml(contactConfig.whatsapp.href)}" style="color:#1d2532">${ltr(contactConfig.whatsapp.display)}</a></p>
  </td></tr></table></body></html>`;
  return {
    subject: `ملخص الطلب — ${brand}`,
    text,
    html,
    attachments: [
      {
        filename: "darakit-logo.png",
        content: Buffer.from(logo.base64, "base64"),
        contentType: "image/png",
        contentDisposition: "inline",
        cid: logoCid,
      },
    ],
  };
}
