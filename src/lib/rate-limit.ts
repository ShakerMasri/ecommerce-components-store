import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { env } from "~/env";

type RateLimitBucket =
  | "auth"
  | "verificationEmail"
  | "publicRead"
  | "profileUpdate"
  | "cartMutation"
  | "orderCreate"
  | "adminMutation"
  | "adminUpload";

type RateLimitResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function createRedisClient() {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const redis = createRedisClient();

const limiters = redis
  ? {
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "10 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:auth",
      }),
      verificationEmail: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, "1 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:verification-email",
      }),
      publicRead: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(300, "1 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:public-read",
      }),
      profileUpdate: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "10 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:profile-update",
      }),
      cartMutation: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:cart-mutation",
      }),
      orderCreate: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "10 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:order-create",
      }),
      adminMutation: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, "10 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:admin-mutation",
      }),
      adminUpload: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "10 m"),
        analytics: true,
        prefix: "ecommerce-template:rate-limit:admin-upload",
      }),
    }
  : null;

function getClientIp(request: Request) {
  // Deployment requirement: these headers are trustworthy only if the verified
  // ingress overwrites them and prevents direct access. Host selection and spoof
  // checks are still pending; see R2 in docs/release-plan.md.
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "local"
  );
}

function getIdentifier(request: Request, identifier?: string) {
  if (identifier) {
    return `user:${identifier}`;
  }

  return `ip:${getClientIp(request)}`;
}

function unavailable(bucket: RateLimitBucket): RateLimitResult {
  // Catalog reads deliberately remain available during Redis outages.
  if (bucket === "publicRead") return { ok: true };

  return {
    ok: false,
    response: NextResponse.json(
      {
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "Service temporarily unavailable. Please try again later.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    ),
  };
}

export async function rateLimit(
  request: Request,
  bucket: RateLimitBucket,
  identifier?: string,
): Promise<RateLimitResult> {
  if (!limiters) {
    return env.NODE_ENV === "production" ? unavailable(bucket) : { ok: true };
  }

  try {
    const result = await limiters[bucket].limit(
      getIdentifier(request, identifier),
    );

    // Upstash's default five-second timeout returns success: true.
    if (result.reason === "timeout") {
      console.error("Rate limit check timed out:", bucket);
      return unavailable(bucket);
    }

    if (result.success) {
      return { ok: true };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );

    return {
      ok: false,
      response: NextResponse.json(
        {
          message: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
          },
        },
      ),
    };
  } catch {
    // Do not log Redis error text: it can contain credentials or request data.
    console.error("Rate limit check failed:", bucket);

    return unavailable(bucket);
  }
}
