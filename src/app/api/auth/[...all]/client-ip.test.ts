// @vitest-environment node
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { BetterAuthOptions } from "better-auth";
import type { auth as authInstance } from "~/lib/auth";
import type { rateLimit as limitRequest } from "~/lib/rate-limit";
import type * as AuthRoutes from "./route";

const mocks = vi.hoisted(() => ({
  env: {
    NODE_ENV: "production",
    APP_URL: "https://darakit.com",
    BETTER_AUTH_URL: "https://darakit.com",
    BETTER_AUTH_SECRET: "offline-test-secret-at-least-32-characters",
    UPSTASH_REDIS_REST_URL: "https://redis.example.invalid",
    UPSTASH_REDIS_REST_TOKEN: "offline-test",
  },
  limit: vi.fn(),
  sendEmail: vi.fn(() => {
    throw new Error("Email forbidden in offline IP tests");
  }),
}));
vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("~/lib/prisma", () => ({ prisma: {} }));
vi.mock("~/server/email", () => ({ sendAuthEmail: mocks.sendEmail }));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = mocks.limit;
  },
}));

let auth: typeof authInstance;
let routes: typeof AuthRoutes;
let rateLimit: typeof limitRequest;
const buckets = new Map<
  string,
  { key: string; count: number; lastRequest: number }
>();
const authKeys: string[] = [];

beforeAll(async () => {
  // Better Auth captures this environment at import. Exercise its production
  // missing-IP behavior, not the library's test-only localhost fallback.
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEST", "false");
  ({ auth } = await import("~/lib/auth"));
  routes = await import("./route");
  ({ rateLimit } = await import("~/lib/rate-limit"));
  const context = await auth.$context;
  context.rateLimit.enabled = true;
  context.rateLimit.max = 2;
  context.rateLimit.customRules = { "/sign-in/email": { window: 60, max: 2 } };
  // Only storage and test quota are substituted. Actual config, Next adapter,
  // request preparation, IP resolver and Better Auth limiter execute.
  const options: BetterAuthOptions = context.options;
  options.rateLimit = {
    customStorage: {
      async get(key) {
        authKeys.push(key);
        return buckets.get(key) ?? null;
      },
      async set(key, value) {
        buckets.set(key, value);
      },
    },
  };
});
beforeEach(() => {
  buckets.clear();
  authKeys.length = 0;
  mocks.limit.mockReset().mockResolvedValue({ success: true });
  mocks.env.NODE_ENV = "production";
});
afterAll(() => vi.unstubAllEnvs());

function request(value?: string, method = "GET", headers: HeadersInit = {}) {
  const combined = new Headers(headers);
  if (value !== undefined) combined.set("cf-connecting-ip", value);
  if (method === "POST") {
    combined.set("content-type", "application/json");
    combined.set("origin", "https://darakit.com");
  }
  return new Request(
    `https://darakit.com/api/auth/${method === "POST" ? "sign-in/email" : "get-session"}`,
    {
      method,
      headers: combined,
      ...(method === "POST" ? { body: "{}" } : {}),
    },
  );
}

describe("real Better Auth and application IP consumers (offline)", () => {
  it("configures only the documented Render header and retains /64", () => {
    expect(auth.options.advanced).toEqual({
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"], ipv6Subnet: 64 },
    });
    expect(auth.options.trustedOrigins).toEqual(["https://darakit.com"]);
  });

  it.each([
    ["203.0.113.10", "203.0.113.10"],
    ["::FFFF:cb00:710a", "203.0.113.10"],
    ["2001:DB8:abcd:1234::abcd", "2001:0db8:abcd:1234:0000:0000:0000:0000"],
  ])("both consumers use the same identity for %s", async (value, ip) => {
    await rateLimit(request(value), "publicRead");
    expect((await routes.GET(request(value))).status).toBe(200);
    expect(mocks.limit).toHaveBeenCalledWith(`ip:${ip}`);
    expect(authKeys).toContain(`${ip}|/get-session`);
  });

  it("exhausts A while B stays allowed through the real auth POST adapter", async () => {
    expect((await routes.POST(request("203.0.113.10", "POST"))).status).toBe(
      400,
    );
    expect(
      (
        await routes.POST(
          request("::ffff:203.0.113.10", "POST", {
            "x-forwarded-for": "198.51.100.20",
          }),
        )
      ).status,
    ).toBe(400);
    const denied = await routes.POST(
      request("203.0.113.10", "POST", { "x-real-ip": "198.51.100.30" }),
    );
    expect(denied.status).toBe(429);
    expect(denied.headers.has("x-retry-after")).toBe(true);
    expect((await routes.POST(request("203.0.113.11", "POST"))).status).toBe(
      400,
    );
    expect(mocks.limit.mock.calls.map(([key]) => key)).toEqual([
      "ip:203.0.113.10",
      "ip:203.0.113.10",
      "ip:203.0.113.10",
      "ip:203.0.113.11",
    ]);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("IPv6 spelling/suffix rotation shares quota, another /64 is separate", async () => {
    for (const value of [
      "2001:DB8:1:2::1",
      "2001:0db8:0001:0002:0000:0000:0000:0001",
    ]) {
      expect((await routes.GET(request(value))).status).toBe(200);
    }
    expect((await routes.GET(request("2001:db8:1:2::ffff"))).status).toBe(429);
    expect((await routes.GET(request("2001:db8:1:3::1"))).status).toBe(200);
  });

  it("missing/invalid/multiple headers stay in one limited fallback bucket", async () => {
    const headers = {
      "x-forwarded-for": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
      host: "localhost",
    };
    for (const value of [
      undefined,
      "bad",
      "203.0.113.1,",
      ",203.0.113.1",
      "203.0.113.1, 203.0.113.2",
    ]) {
      await rateLimit(request(value, "GET", headers), "publicRead");
      const response = await routes.GET(request(value, "GET", headers));
      expect(response.status).toBe(authKeys.length <= 2 ? 200 : 429);
    }
    expect(new Set(authKeys)).toEqual(new Set(["no-trusted-ip|/get-session"]));
    expect(
      mocks.limit.mock.calls.every(([key]) => key === "ip:no-trusted-ip"),
    ).toBe(true);
  });

  it.each(["development", "test"])(
    "both consumers ignore supplied IPs locally in %s",
    async (mode) => {
      mocks.env.NODE_ENV = mode;
      await rateLimit(request("203.0.113.20"), "publicRead");
      expect((await routes.GET(request("203.0.113.30"))).status).toBe(200);
      expect(mocks.limit).toHaveBeenCalledWith("ip:127.0.0.1");
      expect(authKeys).toContain("127.0.0.1|/get-session");
    },
  );

  it("preserves authenticated application user keys", async () => {
    for (const [ip, user] of [
      ["bad", "customer-a"],
      ["203.0.113.1", "customer-a"],
      [undefined, "customer-b"],
    ]) {
      await rateLimit(request(ip), "orderCreate", user);
    }
    expect(mocks.limit.mock.calls.map(([key]) => key)).toEqual([
      "user:customer-a",
      "user:customer-a",
      "user:customer-b",
    ]);
  });

  it("application anonymous quota uses stable keys and isolates two clients", async () => {
    const counts = new Map<string, number>();
    // Mocked SDK decisions; this checks application wiring, not live Redis.
    mocks.limit.mockImplementation(async (key: string) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return {
        success: count <= 2,
        limit: 2,
        remaining: Math.max(0, 2 - count),
        reset: Date.now() + 60_000,
      };
    });
    expect(await rateLimit(request("203.0.113.10"), "auth")).toEqual({
      ok: true,
    });
    expect(await rateLimit(request("::ffff:203.0.113.10"), "auth")).toEqual({
      ok: true,
    });
    const denied = await rateLimit(
      request("203.0.113.10", "GET", { "x-forwarded-for": "198.51.100.1" }),
      "auth",
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.response.status).toBe(429);
      expect(denied.response.headers.get("X-RateLimit-Limit")).toBe("2");
      expect(denied.response.headers.has("Retry-After")).toBe(true);
    }
    expect(await rateLimit(request("203.0.113.11"), "auth")).toEqual({
      ok: true,
    });
  });
});
