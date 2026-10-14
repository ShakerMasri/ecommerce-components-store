import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

// Real limiter/client-IP/middleware, synthetic Redis transport only.
const transport = vi.hoisted(() => ({ evalsha: vi.fn(), zincrby: vi.fn() }));
vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://example.invalid",
    UPSTASH_REDIS_REST_TOKEN: "synthetic",
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    evalsha = transport.evalsha;
    zincrby = transport.zincrby;
  },
}));
import { middleware, config } from "./middleware";

beforeEach(() => {
  vi.clearAllMocks();
  transport.evalsha.mockResolvedValue([299, 300]);
  transport.zincrby.mockResolvedValue(1);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("product detail HTTP quota boundary", () => {
  it.each([
    "/products/board",
    "/products/%3Cscript%3E",
    "/products/board?_rsc=test",
  ])("matches %s without header exemptions", (url) => {
    for (const headers of [
      {},
      { RSC: "1", "Next-Router-Prefetch": "1" },
      {
        "User-Agent": "Googlebot",
        "x-skip-rate-limit": "1",
        "x-middleware-subrequest": "middleware:middleware",
      },
    ]) {
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url, headers }),
      ).toBe(true);
    }
  });
  it.each([
    "/products",
    "/api/products/board",
    "/cart",
    "/products/board/extra",
    "/_next/static/test.js",
  ])("leaves %s to its existing boundary", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      false,
    );
  });
  it.each([null, "invalid", "203.0.113.1, 203.0.113.2", "203.0.113.9"])(
    "uses only normalized trusted IP: %s",
    async (ip) => {
      const headers = new Headers({
        "x-forwarded-for": "198.51.100.5",
        "x-real-ip": "198.51.100.6",
        "x-skip-rate-limit": "1",
        cookie: "identity=spoof",
        "user-agent": "Googlebot",
        RSC: "1",
        "Next-Router-Prefetch": "1",
      });
      if (ip) headers.set("cf-connecting-ip", ip);
      const response = await middleware(
        new NextRequest("http://localhost/products/board", { headers }),
      );
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(transport.evalsha).toHaveBeenCalledTimes(1);
      expect(transport.evalsha.mock.calls[0]?.[1][0]).toContain(
        `:ip:${ip === "203.0.113.9" ? ip : "no-trusted-ip"}:`,
      );
    },
  );
  it("returns an uncached 429 with the quota headers intact", async () => {
    transport.evalsha.mockResolvedValue([-1, 300]);
    const response = await middleware(
      new NextRequest("http://localhost/products/board", {
        headers: { "cf-connecting-ip": "203.0.113.42" },
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(
      1,
    );
    expect(response.headers.get("X-RateLimit-Limit")).toBe("300");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.has("X-RateLimit-Reset")).toBe(true);
    expect(transport.evalsha).toHaveBeenCalledTimes(1);
  });
  it("retains publicRead fail-open on transport exceptions and actual library timeout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    transport.evalsha.mockRejectedValueOnce(new Error("synthetic offline"));
    expect(
      (
        await middleware(new NextRequest("http://localhost/products/board"))
      ).headers.get("x-middleware-next"),
    ).toBe("1");
    vi.useFakeTimers();
    transport.evalsha.mockImplementationOnce(
      () => new Promise(() => undefined),
    );
    const response = middleware(
      new NextRequest("http://localhost/products/board"),
    );
    await vi.advanceTimersByTimeAsync(5001);
    expect((await response).headers.get("x-middleware-next")).toBe("1");
    expect(transport.evalsha).toHaveBeenCalledTimes(2);
  });
});
