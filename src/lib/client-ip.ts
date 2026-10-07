import "server-only";

import { isIP } from "node:net";
import { env } from "~/env";

// Render's public ingress overwrites this header. No other forwarding header
// establishes client identity. See docs/render-client-ip-acceptance.md.
export const clientIpOptions = {
  ipAddressHeaders: ["cf-connecting-ip"],
  ipv6Subnet: 64,
};

export function normalizeClientIp(value: string | null): string | null {
  const ip = value?.trim();
  if (!ip || ip.includes("%")) return null;

  const family = isIP(ip);
  if (family === 4) return ip;
  if (family !== 6) return null;

  // WHATWG URL canonicalizes embedded IPv4 into hex and compresses IPv6.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left = "", right = ""] = canonical.split("::");
  const groups = canonical.includes("::")
    ? [
        ...(left ? left.split(":") : []),
        ...Array<string>(
          8 -
            (left ? left.split(":").length : 0) -
            (right ? right.split(":").length : 0),
        ).fill("0"),
        ...(right ? right.split(":") : []),
      ]
    : canonical.split(":");
  const bytes = groups.map((group) => Number.parseInt(group, 16));

  if (bytes.slice(0, 5).every((group) => group === 0) && bytes[5] === 0xffff) {
    const high = bytes[6]!;
    const low = bytes[7]!;
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }

  // Preserve Better Auth's existing /64 policy against IPv6 suffix rotation.
  return bytes
    .map((group, index) =>
      (index < clientIpOptions.ipv6Subnet / 16 ? group : 0)
        .toString(16)
        .padStart(4, "0"),
    )
    .join(":");
}

export function getClientIp(request: Request): string | null {
  // Local requests have no trusted proxy. Never accept client-chosen identities
  // in development/test; production, including local `next start`, needs ingress.
  if (env.NODE_ENV !== "production") return "127.0.0.1";
  return normalizeClientIp(request.headers.get("cf-connecting-ip"));
}

export function withTrustedClientIp(request: Request): Request {
  const ip = getClientIp(request);
  if (request.headers.get("cf-connecting-ip") === ip) return request;

  const headers = new Headers(request.headers);
  if (ip) headers.set("cf-connecting-ip", ip);
  else headers.delete("cf-connecting-ip");

  // Validate before Better Auth's request-phase limiter. Its plugin onRequest
  // hook runs after that limiter and cannot enforce this stricter single value.
  return new Request(request, { headers });
}
