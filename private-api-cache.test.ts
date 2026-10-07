import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { sendResponse } from "next/dist/server/send-response";
import type {
  NodeNextRequest,
  NodeNextResponse,
} from "next/dist/server/base-http/node";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    cartItem: { findMany: vi.fn() },
    order: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  },
}));
vi.mock("./src/env.js", () => ({
  env: { NODE_ENV: "test", APP_URL: "http://localhost:3000" },
}));
vi.mock("~/server/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("~/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("~/server/email", () => ({
  sendCustomerOrderReceiptEmail: vi.fn(),
  sendOrderNotificationEmail: vi.fn(),
}));
import config from "./next.config.js";
import { GET as getCart } from "./src/app/api/cart/route";
import {
  GET as getOrders,
  POST as createOrder,
} from "./src/app/api/orders/route";
import { POST as addCartItem } from "./src/app/api/cart/items/route";

// Exercise Next's actual configured-header matching and Node sender precedence.
// HEAD uses the same header path without needing a socket/body stream; separately
// compare the original response body so a header rule cannot mask status changes.
async function checkPrivateResponse(
  path: string,
  response: Response,
  status: number,
) {
  const body = (await response.clone().json()) as unknown;
  const configured = await unstable_getResponseFromNextConfig({
    url: `http://localhost:3000${path}`,
    nextConfig: config,
  });
  const headers = new Headers(configured.headers);
  // The config test utility synthesizes a text body/content type; that header
  // is not a configured rule and is not present before the real handler runs.
  headers.delete("content-type");
  const outgoing = {
    statusCode: 0,
    statusMessage: "",
    getHeader: (key: string) => headers.get(key) ?? undefined,
    appendHeader: (key: string, value: string) => headers.append(key, value),
    originalResponse: { end: vi.fn() },
  };
  await sendResponse(
    { method: "HEAD" } as NodeNextRequest,
    outgoing as unknown as NodeNextResponse,
    response,
  );
  expect(response.status).toBe(status);
  expect(outgoing.statusCode).toBe(status);
  expect(headers.get("cache-control")).toBe("private, no-store");
  expect(headers.get("content-type")).toBe(
    response.headers.get("content-type"),
  );
  expect(await response.clone().json()).toEqual(body);
  return { body, headers };
}

function orderRequest(body: unknown = {}, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "customer-a" } });
  mocks.rateLimit.mockResolvedValue({ ok: true });
  mocks.prisma.user.findUnique.mockResolvedValue({
    name: "Customer A",
    email: "a@example.invalid",
    emailVerified: true,
    phone: "0599000000",
  });
  mocks.prisma.cartItem.findMany.mockResolvedValue([]);
  mocks.prisma.order.findMany.mockResolvedValue([]);
  mocks.prisma.order.count.mockResolvedValue(1);
  mocks.prisma.order.aggregate.mockResolvedValue({
    _sum: { totalAmount: new Prisma.Decimal(30) },
  });
});

afterEach(() => vi.restoreAllMocks());

describe("private cart/order HTTP responses", () => {
  it("preserves personalized successful cart data and customer-scoped queries", async () => {
    const { body } = await checkPrivateResponse(
      "/api/cart",
      await getCart(),
      200,
    );
    expect(body).toMatchObject({
      cartItems: [],
      customer: { email: "a@example.invalid" },
    });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "customer-a" } }),
    );
    expect(mocks.prisma.cartItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "customer-a" } }),
    );
  });

  it("preserves successful order summaries and scopes each customer's query", async () => {
    for (const id of ["customer-a", "customer-b"]) {
      mocks.auth.mockResolvedValue({ user: { id } });
      const { body } = await checkPrivateResponse(
        "/api/orders",
        await getOrders(new Request("http://localhost:3000/api/orders")),
        200,
      );
      expect(body).toMatchObject({
        orders: [],
        summary: { totalOrders: 1, totalSpent: "30" },
      });
      expect(mocks.prisma.order.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { userId: id } }),
      );
    }
  });

  it("covers signed-out cart, order read and nested mutation early returns", async () => {
    mocks.auth.mockResolvedValue(null);
    await checkPrivateResponse("/api/cart", await getCart(), 401);
    await checkPrivateResponse(
      "/api/orders",
      await getOrders(new Request("http://localhost:3000/api/orders")),
      401,
    );
    await checkPrivateResponse(
      "/api/cart/items",
      await addCartItem(orderRequest()),
      401,
    );
    await checkPrivateResponse(
      "/api/orders",
      await createOrder(orderRequest()),
      401,
    );
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("covers an authenticated CSRF denial before limits or commerce work", async () => {
    const { body } = await checkPrivateResponse(
      "/api/orders",
      await createOrder(orderRequest({}, "https://untrusted.example.invalid")),
      403,
    );
    expect(body).toEqual({ message: "Invalid request origin." });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("covers validation early returns without querying or writing order data", async () => {
    await checkPrivateResponse(
      "/api/orders?page=bad",
      await getOrders(new Request("http://localhost:3000/api/orders?page=bad")),
      400,
    );
    const { body } = await checkPrivateResponse(
      "/api/orders",
      await createOrder(orderRequest()),
      400,
    );
    expect(body).toMatchObject({ message: "Invalid order request." });
    expect(mocks.prisma.order.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([429, 503])(
    "covers limiter %s early returns, including existing no-store and quota headers",
    async (status) => {
      const denied = NextResponse.json(
        { message: "Limit fixture" },
        {
          status,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "8",
            "X-RateLimit-Limit": "5",
          },
        },
      );
      denied.cookies.set("fixture", "unchanged", { httpOnly: true });
      mocks.rateLimit.mockResolvedValue({ ok: false, response: denied });
      const response = await createOrder(orderRequest());
      expect(response).toBe(denied);
      const { body, headers } = await checkPrivateResponse(
        "/api/orders",
        response,
        status,
      );
      expect(body).toEqual({ message: "Limit fixture" });
      expect(headers.get("retry-after")).toBe("8");
      expect(headers.get("x-ratelimit-limit")).toBe("5");
      expect(headers.getSetCookie()).toEqual(response.headers.getSetCookie());
      expect(mocks.rateLimit).toHaveBeenCalledWith(
        expect.any(Request),
        "orderCreate",
        "customer-a",
      );
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it("covers handled database failures on both personalized reads", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.prisma.cartItem.findMany.mockRejectedValue(
      new Error("Synthetic unavailable database"),
    );
    mocks.prisma.order.findMany.mockRejectedValue(
      new Error("Synthetic unavailable database"),
    );
    const cart = await checkPrivateResponse("/api/cart", await getCart(), 500);
    const orders = await checkPrivateResponse(
      "/api/orders",
      await getOrders(new Request("http://localhost:3000/api/orders")),
      500,
    );
    expect(cart.body).toEqual({ message: "Failed to load cart." });
    expect(orders.body).toMatchObject({
      message: expect.stringContaining("err_"),
    });
  });

  it("prevents a conflicting route cache directive from replacing the private boundary policy", async () => {
    const response = NextResponse.json(
      { privateFixture: true },
      { headers: { "Cache-Control": "public, s-maxage=600" } },
    );
    const { body } = await checkPrivateResponse("/api/cart", response, 200);
    expect(body).toEqual({ privateFixture: true });
  });
});
