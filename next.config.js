/**
 * Nonproduction commands may use `SKIP_ENV_VALIDATION` to skip validation.
 * Production builds always validate; compilation-only checks need placeholders.
 */
import "./src/env.js";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = !isProduction;
const appUrl = process.env.APP_URL ?? "";
const isHttpsDeployment = isProduction && appUrl.startsWith("https://");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  `connect-src 'self'${isDevelopment ? " ws: wss: http://localhost:*" : ""}`,
  "media-src 'self' https:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  isHttpsDeployment ? "upgrade-insecure-requests" : "",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "X-XSS-Protection",
    value: "0",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
  },
];

const productionSecurityHeaders = isHttpsDeployment
  ? [
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000",
      },
    ]
  : [];

/** @type {import("next").NextConfig} */
const config = {
  poweredByHeader: false,

  images: {
    // Product images use Cloudinary delivery transformations; logos are SVGs.
    // Disable the unused /_next/image endpoint as well as client optimization.
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, ...productionSecurityHeaders],
      },
      // Apply at the response boundary, including early denials and failures.
      // Public catalog APIs keep their existing cache behavior.
      ...["auth", "cart", "orders", "profile", "admin"].map((group) => ({
        source: `/api/${group}/:path*`,
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      })),
    ];
  },
};

export default config;
