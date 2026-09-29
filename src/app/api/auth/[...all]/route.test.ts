import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as RateLimitModule from "~/lib/rate-limit";

const mocks = vi.hoisted(() => ({
  handlerGet: vi.fn(() => new Response(null, { status: 200 })),
  handlerPost: vi.fn(() => Response.json({ ok: true })),
  rateLimit: vi.fn(),
  redisLimit: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
  },
}));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = mocks.redisLimit;
  },
}));

afterEach(() => vi.restoreAllMocks());

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: mocks.handlerGet,
    POST: mocks.handlerPost,
  })),
}));

vi.mock("~/lib/auth", () => ({
  auth: {},
}));

vi.mock("~/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

import { POST } from "./route";

function createJsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/[...all]", () => {
  it.each([
    ["/sign-in/email", 0],
    ["/sign-up/email", 0],
    ["/request-password-reset", 0],
    ["/send-verification-email", 0],
    ["/send-verification-email", 1],
    ["/send-verification-email", 2],
  ] as const)(
    "stops auth/email side effects at %s limiter %i",
    async (path, allowedChecks) => {
      const actual =
        await vi.importActual<typeof RateLimitModule>("~/lib/rate-limit");
      mocks.rateLimit.mockImplementation(actual.rateLimit);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      for (const outcome of ["denied", "error", "timeout"] as const) {
        mocks.redisLimit.mockReset();
        for (let i = 0; i < allowedChecks; i++) {
          mocks.redisLimit.mockResolvedValueOnce({ success: true });
        }
        if (outcome === "error")
          mocks.redisLimit.mockRejectedValueOnce(new Error("offline"));
        else
          mocks.redisLimit.mockResolvedValueOnce({
            success: outcome === "timeout",
            reason: outcome === "timeout" ? "timeout" : undefined,
            limit: 1,
            remaining: 0,
            reset: Date.now() + 10_000,
          });
        const response = await POST(
          createJsonRequest(`/api/auth${path}`, {
            email: "test@example.com",
            password: "password123",
          }),
        );
        expect(response.status).toBe(outcome === "denied" ? 429 : 503);
        expect(mocks.redisLimit).toHaveBeenCalledTimes(allowedChecks + 1);
        expect(mocks.handlerPost).not.toHaveBeenCalled();
      }
    },
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({ ok: true });
    mocks.handlerPost.mockResolvedValue(Response.json({ ok: true }));
  });

  it("applies normal auth rate limit to all auth POST requests", async () => {
    const request = createJsonRequest("/api/auth/sign-in/email", {
      email: "test@example.com",
      password: "password123",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimit).toHaveBeenCalledWith(request, "auth");
    expect(mocks.handlerPost).toHaveBeenCalledWith(request);
  });

  it("applies stricter verification email limits before Better Auth handles resend", async () => {
    const request = createJsonRequest("/api/auth/send-verification-email", {
      email: "TEST@EXAMPLE.COM",
      callbackURL: "/account",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    expect(mocks.rateLimit).toHaveBeenNthCalledWith(1, request, "auth");
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      2,
      request,
      "verificationEmail",
    );
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      3,
      request,
      "verificationEmail",
      "verification-email:test@example.com",
    );

    expect(mocks.handlerPost).toHaveBeenCalledWith(request);
  });

  it("does not call Better Auth when verification email IP limit fails", async () => {
    const limitedResponse = Response.json(
      { message: "Too many requests. Please try again later." },
      { status: 429 },
    );

    mocks.rateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, response: limitedResponse });

    const request = createJsonRequest("/api/auth/send-verification-email", {
      email: "test@example.com",
      callbackURL: "/account",
    });

    const response = await POST(request);
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(429);
    expect(body.message).toBe("Too many requests. Please try again later.");
    expect(mocks.handlerPost).not.toHaveBeenCalled();
  });

  it("does not call Better Auth when verification email address limit fails", async () => {
    const limitedResponse = Response.json(
      { message: "Too many requests. Please try again later." },
      { status: 429 },
    );

    mocks.rateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, response: limitedResponse });

    const request = createJsonRequest("/api/auth/send-verification-email", {
      email: "test@example.com",
      callbackURL: "/account",
    });

    const response = await POST(request);
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(429);
    expect(body.message).toBe("Too many requests. Please try again later.");
    expect(mocks.handlerPost).not.toHaveBeenCalled();
  });
});
