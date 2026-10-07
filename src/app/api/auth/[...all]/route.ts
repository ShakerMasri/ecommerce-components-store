import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "~/lib/auth";
import { withTrustedClientIp } from "~/lib/client-ip";
import { rateLimit } from "~/lib/rate-limit";

const handlers = toNextJsHandler((request) =>
  auth.handler(withTrustedClientIp(request)),
);

export const GET = handlers.GET;

function isSendVerificationEmailRequest(request: Request) {
  const pathname = new URL(request.url).pathname;

  return pathname.endsWith("/send-verification-email");
}

async function getVerificationEmailFromRequest(request: Request) {
  try {
    const body = (await request.clone().json()) as unknown;

    if (!body || typeof body !== "object" || !("email" in body)) {
      return null;
    }

    const email = (body as { email?: unknown }).email;

    if (typeof email !== "string") {
      return null;
    }

    const normalizedEmail = email.trim().toLowerCase();

    return normalizedEmail.length > 0 ? normalizedEmail : null;
  } catch {
    return null;
  }
}

async function rateLimitVerificationEmailRequest(request: Request) {
  const ipLimited = await rateLimit(request, "verificationEmail");

  if (!ipLimited.ok) {
    return ipLimited.response;
  }

  const email = await getVerificationEmailFromRequest(request);

  if (!email) {
    return null;
  }

  const emailLimited = await rateLimit(
    request,
    "verificationEmail",
    `verification-email:${email}`,
  );

  if (!emailLimited.ok) {
    return emailLimited.response;
  }

  return null;
}

export async function POST(request: Request) {
  const limited = await rateLimit(request, "auth");

  if (!limited.ok) {
    return limited.response;
  }

  if (isSendVerificationEmailRequest(request)) {
    const verificationLimited =
      await rateLimitVerificationEmailRequest(request);

    if (verificationLimited) {
      return verificationLimited;
    }
  }

  return handlers.POST(request);
}
