import { readPublicSitemap } from "~/server/public-sitemap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A route handler gives both success and failure explicit cache/status semantics.
// Emit XML only after every batch and the read-only transaction have succeeded.
export async function GET() {
  try {
    return new Response(await readPublicSitemap(), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "60",
      },
    });
  }
}
