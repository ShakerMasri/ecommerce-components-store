// Synthetic, offline preview only. Never imports env, auth, Prisma client or SMTP config.
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import nodemailer from "nodemailer";
import { chromium } from "@playwright/test";

const output = await mkdtemp(join(tmpdir(), "darakit-receipt-preview-"));
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, watch: null },
  resolve: {
    alias: { "~": fileURLToPath(new URL("../src", import.meta.url)) },
  },
});
const transport = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
});
let browser;
try {
  const { buildOrderReceipt } = await vite.ssrLoadModule(
    "/src/server/order-receipt.ts",
  );
  // Decimal-compatible synthetic values; these never enter checkout/database code.
  const amount = (value) => ({ toFixed: (digits) => value.toFixed(digits) });
  const fixture = {
    id: "synthetic-order-20261003-001",
    createdAt: new Date("2026-10-03T12:00:00Z"),
    deliveryAreaKey: "west_bank_cities",
    deliveryCity: "نابلس",
    deliveryPrice: amount(20),
    totalAmount: amount(120),
    items: [
      {
        quantity: 2,
        priceAtPurchase: amount(40),
        subtotalAmount: amount(80),
        productNameAtPurchase: "لوحة تطوير ESP32",
        selectedOptionLabel: "USB-C / 5V",
        selectedSizeLabel: null,
        selectedColorLabel: null,
      },
      {
        quantity: 1,
        priceAtPurchase: amount(20),
        subtotalAmount: amount(20),
        productNameAtPurchase: "أسلاك توصيل <عينة> & Kit",
        selectedOptionLabel: null,
        selectedSizeLabel: null,
        selectedColorLabel: null,
      },
    ],
  };
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("**/*", (route) => route.abort());
  const longProduct = "P".repeat(100);
  const longOption = "O".repeat(80);
  const labels = (product, option) => ({
    ...fixture,
    items: [
      {
        ...fixture.items[0],
        productNameAtPurchase: product,
        selectedOptionLabel: option,
      },
      fixture.items[1],
    ],
  });
  const collection = (order) => ({
    ...order,
    deliveryAreaKey: "nablus_receive_point",
    deliveryPrice: amount(0),
    totalAmount: amount(100),
  });
  const cases = [
    ["delivery", fixture],
    ["collection", collection(fixture)],
    ["product-100", labels(longProduct, fixture.items[0].selectedOptionLabel)],
    ["option-80", labels(fixture.items[0].productNameAtPurchase, longOption)],
    ["long-combined", labels(longProduct, longOption)],
    ["collection-long-combined", collection(labels(longProduct, longOption))],
  ];
  const metrics = [];
  for (const [name, order] of cases) {
    const mail = buildOrderReceipt(order);
    const mime = await transport.sendMail({
      from: '"DaraKit" <support@darakit.com>',
      to: "synthetic@example.invalid",
      ...mail,
    });
    await writeFile(join(output, `${name}.eml`), mime.message);
    await writeFile(join(output, `${name}.txt`), mail.text);
    // Browser cannot resolve MIME CIDs: substitute the same bundled bytes locally.
    const html = mail.html.replace(
      "cid:darakit-logo@darakit.com",
      `data:image/png;base64,${mail.attachments[0].content.toString("base64")}`,
    );
    await writeFile(join(output, `${name}.html`), html);
    for (const [width, imagesBlocked] of [
      [375, false],
      [720, false],
      [375, true],
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.setContent(
        imagesBlocked ? html.replace(/<img\b[^>]*>/g, "") : html,
      );
      // Measure rendered text fragments as well as page width. This detects
      // offscreen/clipped labels and totals even if a parent hides overflow.
      const measured = await page.evaluate(() => {
        const range = document.createRange();
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        const offscreen = [];
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          range.selectNodeContents(walker.currentNode);
          for (const rect of range.getClientRects()) {
            if (rect.left < -1 || rect.right > innerWidth + 1)
              offscreen.push(walker.currentNode.textContent);
          }
        }
        const labelLines = [
          ...document.querySelectorAll('span[dir="auto"]'),
        ].map((span) => {
          range.selectNodeContents(span);
          return {
            text: span.textContent,
            lines: range.getClientRects().length,
          };
        });
        return {
          viewport: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          offscreen,
          labelLines,
        };
      });
      if (measured.scrollWidth > width || measured.offscreen.length)
        throw new Error(`${name} overflow: ${JSON.stringify(measured)}`);
      for (const item of order.items) {
        if (
          !(await page.locator("body").innerText()).includes(
            item.productNameAtPurchase,
          )
        )
          throw new Error("Missing product text");
      }
      for (const label of [longProduct, longOption]) {
        const rendered = measured.labelLines.find(
          (entry) => entry.text === label,
        );
        if (width === 375 && rendered && rendered.lines < 2)
          throw new Error("Long label did not wrap");
      }
      for (const value of [
        "40.00",
        "80.00",
        order.totalAmount.toFixed(2),
        "الدفع نقدًا عند الاستلام.",
      ]) {
        if (!(await page.locator("body").innerText()).includes(value))
          throw new Error(`Missing amount/payment text: ${value}`);
      }
      metrics.push({ name, width, imagesBlocked, ...measured });
      await page.screenshot({
        path: join(
          output,
          `${name}-${width}${imagesBlocked ? "-images-blocked" : ""}.png`,
        ),
        fullPage: true,
      });
    }
  }
  await writeFile(
    join(output, "render-checks.json"),
    JSON.stringify(metrics, null, 2),
  );
  console.log(`Synthetic preview (no inbox acceptance): ${output}`);
} finally {
  await browser?.close();
  transport.close();
  await vite.close();
}
