import { describe, expect, it, vi } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";

vi.mock("./src/env.js", () => ({}));

import config from "./next.config.js";

describe("image delivery configuration", () => {
  it("disables the unused optimizer globally without remote host permissions", () => {
    expect(config.images).toMatchObject({ unoptimized: true });
    expect(config.images?.remotePatterns ?? []).toEqual([]);
    expect(config.images?.domains ?? []).toEqual([]);
  });
});

describe("private API cache policy", () => {
  it.each([
    "/api/cart",
    "/api/cart/",
    "/api/cart/items",
    "/api/cart/items/line-id",
    "/api/orders?page=2",
    "/api/orders/",
    "/api/profile",
    "/api/admin/products",
    "/api/admin/orders/order-id/status",
    "/api/admin/uploads/product-images",
    "/api/auth/get-session",
    "/api/auth/sign-in/email",
  ])(
    "marks %s private and non-storable without requiring a cookie",
    async (path) => {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://store.example.invalid${path}`,
        nextConfig: config,
      });

      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    },
  );

  it.each([
    "/api/products",
    "/api/products/part",
    "/api/products?page=2",
    "/api/categories",
    "/api/cartography",
    "/api/orders-public",
    "/products",
    "/shipping",
    "/_next/static/chunk.js",
  ])("leaves the existing caching of %s unchanged", async (path) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://store.example.invalid${path}`,
      nextConfig: config,
    });

    expect(response.headers.get("cache-control")).toBeNull();
  });
});
