import "server-only";

import { Prisma } from "@prisma/client";
import { storeConfig } from "~/config/store";
import { prisma } from "~/lib/prisma";
import { productSlugSchema } from "~/server/validations/product";

export const sitemapLimits = {
  batchSize: 500,
  maxQueries: 201,
  maxDurationMs: 10_000,
  maxUrls: 50_000,
  maxBytes: 50 * 1024 * 1024,
} as const;

const publicPaths = [
  "/",
  "/products",
  "/contact",
  "/shipping",
  "/returns",
  "/terms",
  "/privacy",
];
const xmlStart =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const xmlEnd = "</urlset>\n";

// Count the exact UTF-8 output, including the envelope and static URLs.
export function createSitemapDocument(
  limits: { maxUrls: number; maxBytes: number } = sitemapLimits,
) {
  const entries: string[] = [];
  let bytes = Buffer.byteLength(xmlStart + xmlEnd, "utf8");
  return {
    add(url: string) {
      const escaped = url.replace(
        /[&<>"']/g,
        (character) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
          })[character]!,
      );
      const entry = `  <url><loc>${escaped}</loc></url>\n`;
      bytes += Buffer.byteLength(entry, "utf8");
      if (entries.length >= limits.maxUrls || bytes > limits.maxBytes) {
        throw new Error("Sitemap output limit exceeded");
      }
      entries.push(entry);
    },
    finish() {
      if (bytes > limits.maxBytes)
        throw new Error("Sitemap output limit exceeded");
      return xmlStart + entries.join("") + xmlEnd;
    },
  };
}

export async function readPublicSitemap(): Promise<string> {
  const started = Date.now();
  const checkTime = () => {
    if (Date.now() - started >= sitemapLimits.maxDurationMs) {
      throw new Error("Sitemap time budget exceeded");
    }
  };
  return prisma.$transaction(
    async (transaction) => {
      // All batches see one catalog snapshot. This transaction cannot write data.
      await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
      await transaction.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      const document = createSitemapDocument();
      for (const path of publicPaths) document.add(`${storeConfig.url}${path}`);
      let lastId: string | undefined;
      for (let query = 0; query < sitemapLimits.maxQueries; query++) {
        checkTime();
        const rows = await transaction.product.findMany({
          where: {
            isArchived: false,
            ...(lastId ? { id: { gt: lastId } } : {}),
          },
          select: { id: true, slug: true },
          orderBy: { id: "asc" },
          take: sitemapLimits.batchSize,
        });
        checkTime();
        for (const row of rows) {
          const parsed = productSlugSchema.safeParse({ slug: row.slug });
          if (parsed.success && parsed.data.slug === row.slug) {
            document.add(`${storeConfig.url}/products/${row.slug}`);
          }
        }
        if (rows.length < sitemapLimits.batchSize) {
          const xml = document.finish();
          checkTime();
          return xml;
        }
        // Advance over invalid slugs as well as emitted URLs.
        lastId = rows[rows.length - 1]!.id;
      }
      throw new Error("Sitemap query budget exceeded");
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 2_000,
      timeout: sitemapLimits.maxDurationMs,
    },
  );
}
