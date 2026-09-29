import { afterEach, describe, expect, it, vi } from "vitest";

type EnvMock = {
  NODE_ENV?: "test" | "production";
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

async function loadRateLimit(envMock: EnvMock, limitMock = vi.fn()) {
  vi.resetModules();

  const redisConstructor = vi.fn(function RedisMock(config: {
    url: string;
    token: string;
  }) {
    return {
      config,
    };
  });

  const slidingWindowMock = vi.fn(function slidingWindowMock(
    limit: number,
    window: string,
  ) {
    return {
      limit,
      window,
    };
  });

  const ratelimitConstructor = vi.fn(function RatelimitMock(config: {
    redis: unknown;
    limiter: unknown;
    analytics: boolean;
    prefix: string;
  }) {
    return {
      config,
      limit: limitMock,
    };
  });

  const RatelimitMock = Object.assign(ratelimitConstructor, {
    slidingWindow: slidingWindowMock,
  });

  vi.doMock("~/env", () => ({
    env: {
      NODE_ENV: envMock.NODE_ENV ?? "test",
      APP_URL: "http://localhost:3000",
      UPSTASH_REDIS_REST_URL: envMock.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: envMock.UPSTASH_REDIS_REST_TOKEN,
    },
  }));

  vi.doMock("@upstash/redis", () => ({
    Redis: redisConstructor,
  }));

  vi.doMock("@upstash/ratelimit", () => ({
    Ratelimit: RatelimitMock,
  }));

  const rateLimitModule = await import("./rate-limit");

  return {
    ...rateLimitModule,
    limitMock,
    redisConstructor,
    ratelimitConstructor,
    slidingWindowMock,
  };
}

function createRequest(headers?: HeadersInit) {
  return new Request("http://localhost:3000/api/test", {
    headers,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests when Upstash is not configured", async () => {
    const { rateLimit, redisConstructor, ratelimitConstructor } =
      await loadRateLimit({});

    const result = await rateLimit(createRequest(), "auth");

    expect(result.ok).toBe(true);
    expect(redisConstructor).not.toHaveBeenCalled();
    expect(ratelimitConstructor).not.toHaveBeenCalled();
  });

  it("creates a strict verification email limiter", async () => {
    const { ratelimitConstructor, slidingWindowMock } = await loadRateLimit({
      UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    });

    expect(slidingWindowMock).toHaveBeenCalledWith(1, "1 m");
    expect(ratelimitConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        analytics: true,
        prefix: "ecommerce-template:rate-limit:verification-email",
      }),
    );
  });

  it("creates a light public read limiter", async () => {
    const { ratelimitConstructor, slidingWindowMock } = await loadRateLimit({
      UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    });

    expect(slidingWindowMock).toHaveBeenCalledWith(300, "1 m");
    expect(ratelimitConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        analytics: true,
        prefix: "ecommerce-template:rate-limit:public-read",
      }),
    );
  });

  it("allows requests when Upstash limiter succeeds", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      success: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 60_000,
    });

    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );

    const result = await rateLimit(
      createRequest({
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      }),
      "auth",
    );

    expect(result.ok).toBe(true);
    expect(limitMock).toHaveBeenCalledWith("ip:203.0.113.10");
  });

  it("uses user identifier when provided", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
    });

    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );

    const result = await rateLimit(createRequest(), "adminMutation", "admin-1");

    expect(result.ok).toBe(true);
    expect(limitMock).toHaveBeenCalledWith("user:admin-1");
  });

  it("rate limits verification emails by identifier", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      success: true,
      limit: 1,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );

    const result = await rateLimit(
      createRequest(),
      "verificationEmail",
      "verification-email:test@example.com",
    );

    expect(result.ok).toBe(true);
    expect(limitMock).toHaveBeenCalledWith(
      "user:verification-email:test@example.com",
    );
  });

  it("returns 429 response when limit is exceeded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const reset = Date.now() + 10_000;

    const limitMock = vi.fn().mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset,
    });

    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );

    const result = await rateLimit(createRequest(), "orderCreate");

    expect(result.ok).toBe(false);

    if (!result.ok) {
      const body = (await result.response.json()) as { message: string };

      expect(result.response.status).toBe(429);
      expect(body.message).toBe("Too many requests. Please try again later.");
      expect(result.response.headers.get("Retry-After")).toBe("10");
      expect(result.response.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(result.response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(result.response.headers.get("X-RateLimit-Reset")).toBe(
        reset.toString(),
      );
    }
  });

  it("rejects requests if the limiter throws", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const limitMock = vi.fn().mockRejectedValue(new Error("Upstash failed"));

    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );

    const result = await rateLimit(createRequest(), "cartMutation");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(503);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Rate limit check failed:",
      "cartMutation",
    );
  });

  it.each([
    "auth",
    "verificationEmail",
    "profileUpdate",
    "cartMutation",
    "orderCreate",
    "adminMutation",
    "adminUpload",
  ] as const)("rejects errors and timeout successes for %s", async (bucket) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const limitMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("private Redis details"))
      .mockResolvedValueOnce({
        success: true,
        reason: "timeout",
        reset: 0,
        limit: 0,
        remaining: 0,
      });
    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await rateLimit(createRequest(), bucket, "user-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(503);
        expect(result.response.headers.get("Cache-Control")).toBe("no-store");
        expect(result.response.headers.has("X-RateLimit-Limit")).toBe(false);
        expect(await result.response.json()).toEqual({
          code: "RATE_LIMIT_UNAVAILABLE",
          message: "Service temporarily unavailable. Please try again later.",
        });
      }
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "private Redis details",
    );
  });

  it("deliberately allows public reads on errors and timeouts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const limitMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ success: true, reason: "timeout" });
    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );
    expect(await rateLimit(createRequest(), "publicRead")).toEqual({
      ok: true,
    });
    expect(await rateLimit(createRequest(), "publicRead")).toEqual({
      ok: true,
    });
  });

  it.each([
    {},
    { UPSTASH_REDIS_REST_URL: "https://example-upstash.com" },
    { UPSTASH_REDIS_REST_TOKEN: "test-token" },
  ])(
    "rejects production mutations with missing Redis configuration: %j",
    async (config) => {
      const { rateLimit } = await loadRateLimit({
        ...config,
        NODE_ENV: "production",
      });
      const result = await rateLimit(createRequest(), "auth");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(503);
      expect(await rateLimit(createRequest(), "publicRead")).toEqual({
        ok: true,
      });
    },
  );

  it("isolates user keys regardless of supplied forwarding headers", async () => {
    const limitMock = vi.fn().mockResolvedValue({ success: true });
    const { rateLimit } = await loadRateLimit(
      {
        UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
      },
      limitMock,
    );
    for (const id of ["customer-1", "customer-2"]) {
      await rateLimit(
        createRequest({
          "x-forwarded-for": "spoofed",
          "x-real-ip": "spoofed",
          "cf-connecting-ip": "spoofed",
        }),
        "orderCreate",
        id,
      );
    }
    expect(limitMock.mock.calls).toEqual([
      ["user:customer-1"],
      ["user:customer-2"],
    ]);
  });
});
