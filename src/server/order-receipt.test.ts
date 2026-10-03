// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import net from "node:net";
import { Duplex } from "node:stream";
import { setImmediate as realImmediate } from "node:timers";
import { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactConfig } from "~/config/contact";
import { buildOrderReceipt, type ReceiptOrder } from "./order-receipt";
import { sendCustomerOrderReceiptEmail } from "./email";
import logo from "./assets/darakit-logo.json";
import { runCheckoutEmailWork } from "./checkout-email";

const env = vi.hoisted(() => ({
  NODE_ENV: "production",
  EMAIL_DELIVERY_MODE: "smtp",
  SMTP_HOST: "smtp.example.invalid",
  SMTP_PORT: 587,
  SMTP_USER: "fixture",
  SMTP_PASSWORD: "fixture",
  SMTP_FROM_EMAIL: "support@darakit.com",
  SMTP_FROM_NAME: "DaraKit",
  ORDER_RECEIPT_FROM_EMAIL: undefined as string | undefined,
  ORDER_NOTIFICATION_EMAIL: "owner@example.invalid",
}));
vi.mock("~/env", () => ({ env }));

const order: ReceiptOrder = {
  id: 'order-<&"123',
  createdAt: new Date("2026-10-03T12:00:00Z"),
  totalAmount: new Prisma.Decimal("101.50"),
  deliveryPrice: new Prisma.Decimal("21.50"),
  deliveryAreaKey: "west_bank_cities",
  deliveryCity: "نابلس <شرق>",
  items: [
    {
      quantity: 2,
      priceAtPurchase: new Prisma.Decimal("40"),
      subtotalAmount: new Prisma.Decimal("80"),
      productNameAtPurchase: 'لوحة <script>alert("x")</script> & ESP32',
      selectedOptionLabel: '5V & "USB"',
      selectedSizeLabel: "unused size",
      selectedColorLabel: "unused color",
    },
  ],
};
const realCreateTransport = nodemailer.createTransport.bind(nodemailer);
beforeEach(() => {
  env.ORDER_RECEIPT_FROM_EMAIL = undefined;
});
afterEach(() => vi.restoreAllMocks());

describe("Arabic customer order receipt", () => {
  it("uses RTL escaped snapshots, final discounted prices, persisted fees and support contacts without actions", () => {
    const mail = buildOrderReceipt(order);
    expect(mail.subject).toBe("ملخص الطلب — دارة كيت / DaraKit");
    for (const value of [
      "ملخص الطلب",
      "دارة كيت",
      "DaraKit",
      "الدفع نقدًا عند الاستلام.",
      "101.50",
      "21.50",
      "40.00",
      "80.00",
      "الكمية:",
      "خصم مطبق",
      "2026",
      contactConfig.email.address,
      contactConfig.whatsapp.display,
    ]) {
      expect(mail.html).toContain(value);
      expect(mail.text).toContain(value);
    }
    expect(mail.html).toContain('lang="ar" dir="rtl"');
    expect(mail.html).toContain('dir="ltr"');
    expect(mail.text).toContain("\u2066");
    expect(mail.html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; ESP32",
    );
    expect(mail.html).toContain("5V &amp; &quot;USB&quot;");
    expect(mail.html).toContain("order-&lt;&amp;&quot;123");
    expect(mail.html).toContain("نابلس &lt;شرق&gt;");
    expect(mail.html).toContain(`href="${contactConfig.whatsapp.href}"`);
    expect(mail.html).not.toMatch(
      /<script|localhost|<button|verify|token|unused size|unused color/,
    );
    expect(mail.text).not.toMatch(/تم الدفع|فاتورة ضريبية/);
  });

  it("describes arranged Nablus collection with its persisted fee, without calling it home delivery", () => {
    const mail = buildOrderReceipt({
      ...order,
      deliveryAreaKey: "nablus_receive_point",
      deliveryPrice: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(80),
    });
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("استلام من نقطة في نابلس بترتيب مسبق عبر واتساب.");
      expect(body).toContain("رسوم الاستلام:");
      expect(body).toContain("0.00");
      expect(body).not.toContain("التوصيل إلى:");
      expect(body).not.toContain("رسوم التوصيل:");
    }
  });

  it("preserves legacy option fallback and omits invented labels for default options", () => {
    const legacy = buildOrderReceipt({
      ...order,
      items: [
        {
          ...order.items[0]!,
          selectedOptionLabel: null,
          selectedSizeLabel: "12V",
          selectedColorLabel: "أزرق",
        },
      ],
    });
    expect(legacy.html).toContain("12V / أزرق");
    const defaults = buildOrderReceipt({
      ...order,
      items: [
        {
          ...order.items[0]!,
          selectedOptionLabel: null,
          selectedSizeLabel: null,
          selectedColorLabel: null,
        },
      ],
    });
    expect(defaults.html).not.toContain("الخيار:");
  });

  it("bundles a PNG of the unchanged existing logo", () => {
    expect(logo.sourceSha256).toBe(
      createHash("sha256").update(readFileSync(logo.source)).digest("hex"),
    );
    const png = buildOrderReceipt(order).attachments[0]!.content;
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(660);
    expect(png.readUInt32BE(20)).toBe(116);
  });

  it.each([undefined, "orders@darakit.com"])(
    "constructs real in-memory MIME with receipt sender %s, separate customer recipient, text and CID PNG",
    async (receiptSender) => {
      env.ORDER_RECEIPT_FROM_EMAIL = receiptSender;
      const sender = receiptSender ?? env.SMTP_FROM_EMAIL;
      const transport = realCreateTransport({
        streamTransport: true,
        buffer: true,
        newline: "unix",
      });
      vi.spyOn(nodemailer, "createTransport").mockReturnValue(transport);
      const send = vi.spyOn(transport, "sendMail");
      try {
        await sendCustomerOrderReceiptEmail({
          to: "verified@example.invalid",
          order,
        });
        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith(
          expect.objectContaining({
            from: `"DaraKit" <${sender}>`,
            to: "verified@example.invalid",
            ...buildOrderReceipt(order),
          }),
        );
        const result = await send.mock.results[0]!.value;
        expect(result.envelope).toEqual({
          from: sender,
          to: ["verified@example.invalid"],
        });
        const mime = result.message.toString();
        expect(mime).toContain(`From: DaraKit <${sender}>`);
        for (const value of [
          "multipart/alternative",
          "multipart/related",
          "text/plain",
          "text/html",
          "image/png",
          "Content-ID: <darakit-logo@darakit.com>",
          "Content-Disposition: inline",
          "darakit-logo.png",
        ])
          expect(mime).toContain(value);
        expect(mime).not.toContain("owner@example.invalid");
        expect(mime).not.toContain("localhost");
      } finally {
        transport.close();
      }
    },
  );

  it("sanitizes receipt SMTP failure without message or provider details", async () => {
    const transport = realCreateTransport({
      streamTransport: true,
      buffer: true,
    });
    vi.spyOn(nodemailer, "createTransport").mockReturnValue(transport);
    vi.spyOn(transport, "sendMail").mockRejectedValue(
      new Error("private recipient and body"),
    );
    try {
      await expect(
        sendCustomerOrderReceiptEmail({
          to: "verified@example.invalid",
          order,
        }),
      ).rejects.toEqual(new Error("Email delivery failed."));
    } finally {
      transport.close();
    }
  });

  it.each([undefined, "orders@darakit.com"])(
    "preserves receipt sender %s, authentication, recipient and CID MIME through the bounded checkout adapter in memory",
    async (receiptSender) => {
      env.ORDER_RECEIPT_FROM_EMAIL = receiptSender;
      const sender = receiptSender ?? env.SMTP_FROM_EMAIL;
      let data = false;
      let mime = "";
      const commands: string[] = [];
      const wire = new Duplex({
        read() {
          return;
        },
        write(chunk: Buffer, _encoding, callback) {
          const text = chunk.toString();
          if (data) {
            mime += text;
            if (mime.endsWith("\r\n.\r\n")) this.push("250 queued\r\n");
          } else {
            commands.push(text);
            if (text.startsWith("EHLO"))
              this.push("250-fixture\r\n250 AUTH PLAIN\r\n");
            else if (text.startsWith("AUTH"))
              this.push("235 authenticated\r\n");
            else if (text.startsWith("DATA")) {
              data = true;
              this.push("354 send message\r\n");
            } else this.push("250 ok\r\n");
          }
          callback();
        },
      });
      Object.assign(wire, { setTimeout: () => wire, setKeepAlive: () => wire });
      vi.spyOn(net, "createConnection").mockImplementation(() => {
        queueMicrotask(() => {
          wire.emit("connect");
          realImmediate(() => wire.push("220 fixture\r\n"));
        });
        return wire as net.Socket;
      });
      try {
        const results = await runCheckoutEmailWork([
          (budget) =>
            sendCustomerOrderReceiptEmail(
              { to: "verified@example.invalid", order },
              budget,
            ),
        ]);
        expect(results).toEqual([{ status: "fulfilled", value: undefined }]);
        expect(
          commands.some((command) => command.startsWith("AUTH PLAIN")),
        ).toBe(true);
        expect(commands).toContain(`MAIL FROM:<${sender}>\r\n`);
        expect(mime).toContain(`From: DaraKit <${sender}>`);
        expect(commands).toContain("RCPT TO:<verified@example.invalid>\r\n");
        for (const part of [
          "multipart/alternative",
          "multipart/related",
          "text/plain",
          "text/html",
          "image/png",
          "Content-ID: <darakit-logo@darakit.com>",
        ])
          expect(mime).toContain(part);
        expect(mime).not.toContain("owner@example.invalid");
        expect(wire.destroyed).toBe(true);
      } finally {
        wire.destroy();
      }
    },
  );
});
