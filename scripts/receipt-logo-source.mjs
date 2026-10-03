import { createHash } from "node:crypto";

/**
 * Normalize only CRLF byte pairs to LF. Preserve lone CR, whitespace, encoding
 * and every other source byte so actual SVG changes still invalidate provenance.
 * @param {Uint8Array} source
 */
export function normalizeReceiptLogoSource(source) {
  return Buffer.from(
    Buffer.from(source).filter(
      (byte, index, bytes) => byte !== 13 || bytes[index + 1] !== 10,
    ),
  );
}

/** @param {Uint8Array} source */
export function hashReceiptLogoSource(source) {
  return createHash("sha256")
    .update(normalizeReceiptLogoSource(source))
    .digest("hex");
}
