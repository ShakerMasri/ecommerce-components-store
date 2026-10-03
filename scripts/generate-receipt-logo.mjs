// Offline generation using the already-installed Sharp; no runtime email change.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  hashReceiptLogoSource,
  normalizeReceiptLogoSource,
} from "./receipt-logo-source.mjs";

/**
 * @param {Uint8Array} source
 * @param {number} width
 */
export async function generateReceiptLogo(source, width) {
  const png = await sharp(normalizeReceiptLogoSource(source))
    .resize({ width })
    .png()
    .toBuffer();
  return {
    sourceSha256: hashReceiptLogoSource(source),
    width,
    base64: png.toString("base64"),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const source = "public/darakit-logo.svg";
  const bytes = readFileSync(new URL(`../${source}`, import.meta.url));
  const asset = { source, ...(await generateReceiptLogo(bytes, 660)) };
  writeFileSync(
    new URL("../src/server/assets/darakit-logo.json", import.meta.url),
    `${JSON.stringify(asset, null, 2)}\n`,
  );
}
