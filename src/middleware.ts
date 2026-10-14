import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "~/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const limited = await rateLimit(request, "publicRead");
  if (!limited.ok) {
    limited.response.headers.set("Cache-Control", "no-store");
    return limited.response;
  }
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  // No prefetch/header/bot exemptions. APIs retain their own single boundary.
  matcher: ["/products/:slug"],
};
