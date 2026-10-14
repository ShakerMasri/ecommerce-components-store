// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  readPublicSitemap,
  createSitemapDocument,
  sitemapLimits,
} from "./public-sitemap";
import { GET } from "~/app/sitemap.xml/route";

type Row = { id: string; slug: string; isArchived: boolean };
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("~/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
let rows: Row[];
const row = (index: number): Row => ({
  id: String(index).padStart(8, "0"),
  slug: `board-${index}`,
  isArchived: false,
});
const urls = (xml: string) =>
  [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
  mocks.execute.mockResolvedValue(0);
  mocks.transaction.mockImplementation(async (callback) => {
    // Synthetic snapshot: this proves app batching/transaction wiring, not PostgreSQL isolation.
    const snapshot = structuredClone(rows);
    mocks.findMany.mockImplementation(async (args) =>
      snapshot
        .filter(
          (item) =>
            !item.isArchived && (!args.where.id || item.id > args.where.id.gt),
        )
        .slice(0, args.take),
    );
    return callback({
      product: { findMany: mocks.findMany },
      $executeRaw: mocks.execute,
    });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("bounded complete runtime sitemap using synthetic transaction results", () => {
  it.each([0, 499, 500, 501, 1500])(
    "enumerates %i products exactly with minimal keyset batches",
    async (count) => {
      rows = Array.from({ length: count }, (_, index) => row(index));
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toBe(
        "application/xml; charset=utf-8",
      );
      const xml = await response.text();
      const locations = urls(xml);
      expect(locations).toHaveLength(count + 7);
      expect(new Set(locations).size).toBe(count + 7);
      expect(locations.slice(0, 7)).toEqual(
        [
          "/",
          "/products",
          "/contact",
          "/shipping",
          "/returns",
          "/terms",
          "/privacy",
        ].map((path) => `https://darakit.com${path}`),
      );
      expect(locations.slice(7)).toEqual(
        rows.map((item) => `https://darakit.com/products/${item.slug}`),
      );
      expect(xml).not.toMatch(/lastmod|priority|changefreq|stock|price/);
      expect(mocks.findMany).toHaveBeenCalledTimes(Math.floor(count / 500) + 1);
      for (const [args] of mocks.findMany.mock.calls) {
        expect(args.select).toEqual({ id: true, slug: true });
        expect(args.take).toBe(500);
        expect(args.orderBy).toEqual({ id: "asc" });
        expect(args.where.isArchived).toBe(false);
        expect(args).not.toHaveProperty("skip");
      }
      expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 2000,
        timeout: 10000,
      });
      expect(mocks.execute.mock.calls.map(([sql]) => sql.join(""))).toEqual([
        "SET TRANSACTION READ ONLY",
        "SET LOCAL statement_timeout = '5s'",
      ]);
    },
  );
  it("advances past complete invalid batches and archived rows without truncation", async () => {
    rows = Array.from({ length: 1002 }, (_, index) => ({
      ...row(index),
      slug: index < 500 ? " invalid " : row(index).slug,
    }));
    rows[500]!.isArchived = true;
    rows[501]!.slug = "UPPERCASE";
    const locations = urls(await readPublicSitemap());
    expect(locations).toHaveLength(507);
    expect(locations.slice(7)).toEqual(
      rows
        .slice(502)
        .map((item) => `https://darakit.com/products/${item.slug}`),
    );
    expect(mocks.findMany.mock.calls[1]?.[0].where.id.gt).toBe(row(499).id);
  });
  it("holds a snapshot during create/archive and exposes changes on the next request", async () => {
    rows = Array.from({ length: 501 }, (_, index) => row(index));
    const implementation = mocks.transaction.getMockImplementation()!;
    mocks.transaction.mockImplementation(async (...args) => {
      const pending = implementation(...args);
      rows[500]!.isArchived = true;
      rows.push(row(999));
      return pending;
    });
    const first = urls(await readPublicSitemap());
    expect(first).toContain("https://darakit.com/products/board-500");
    expect(first).not.toContain("https://darakit.com/products/board-999");
    const next = urls(await readPublicSitemap());
    expect(next).not.toContain("https://darakit.com/products/board-500");
    expect(next).toContain("https://darakit.com/products/board-999");
  });
  it.each([
    "later batch",
    "query budget",
    "time budget",
    "transaction",
    "read-only setup",
  ])("returns uncached non-XML failure for %s", async (failure) => {
    if (failure === "transaction")
      mocks.transaction.mockRejectedValue(
        new Error("synthetic private failure"),
      );
    else if (failure === "read-only setup")
      mocks.execute.mockRejectedValue(new Error("synthetic setup failure"));
    else {
      rows = Array.from({ length: 501 }, (_, index) => row(index));
      const implementation = mocks.transaction.getMockImplementation()!;
      mocks.transaction.mockImplementation(async (callback, options) =>
        implementation(async (tx: unknown) => {
          if (failure === "later batch") {
            const read = mocks.findMany.getMockImplementation()!;
            let calls = 0;
            mocks.findMany.mockImplementation(async (args) => {
              if (++calls === 2) throw new Error("synthetic second batch");
              return read(args);
            });
          }
          if (failure === "query budget")
            mocks.findMany.mockImplementation(async (args) =>
              Array.from({ length: 500 }, (_, index) => ({
                id: `${args.where.id?.gt ?? ""}${index}`,
                slug: "INVALID",
              })),
            );
          if (failure === "time budget")
            vi.spyOn(Date, "now").mockReturnValue(20000);
          return callback(tx);
        }, options),
      );
      if (failure === "time budget")
        vi.spyOn(Date, "now").mockReturnValueOnce(0);
    }
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.text()).toBe("Sitemap temporarily unavailable");
    if (failure === "later batch")
      expect(mocks.findMany).toHaveBeenCalledTimes(2);
    if (failure === "query budget")
      expect(mocks.findMany).toHaveBeenCalledTimes(201);
  });
  it.each([49993, 49994])(
    "counts all seven static URLs toward the 50,000 ceiling: %i catalog URLs",
    async (count) => {
      rows = Array.from({ length: count }, (_, index) => row(index));
      const response = await GET();
      expect(response.status).toBe(count === 49993 ? 200 : 503);
      const body = await response.text();
      if (response.status === 200) expect(urls(body)).toHaveLength(50000);
      else expect(body).not.toContain("<urlset");
    },
  );
});

describe("exact sitemap output budgets", () => {
  it("escapes XML and counts UTF-8 bytes including the document envelope", () => {
    const first = createSitemapDocument();
    first.add("https://example.invalid/دارة?x=1&y=\"<'>");
    const xml = first.finish();
    expect(xml).toContain("&amp;y=&quot;&lt;&apos;&gt;");
    const bytes = Buffer.byteLength(xml);
    const exact = createSitemapDocument({ maxUrls: 1, maxBytes: bytes });
    exact.add("https://example.invalid/دارة?x=1&y=\"<'>");
    expect(exact.finish()).toBe(xml);
    expect(() => exact.add("https://example.invalid/extra")).toThrow(
      "output limit",
    );
    const short = createSitemapDocument({ maxUrls: 1, maxBytes: bytes - 1 });
    expect(() => short.add("https://example.invalid/دارة?x=1&y=\"<'>")).toThrow(
      "output limit",
    );
  });
  it("accepts exactly 50 MB and rejects one extra uncompressed byte", () => {
    const blank = createSitemapDocument();
    blank.add("");
    const overhead = Buffer.byteLength(blank.finish());
    const exact = createSitemapDocument();
    exact.add("a".repeat(sitemapLimits.maxBytes - overhead));
    expect(Buffer.byteLength(exact.finish())).toBe(50 * 1024 * 1024);
    const overflow = createSitemapDocument();
    expect(() =>
      overflow.add("a".repeat(sitemapLimits.maxBytes - overhead + 1)),
    ).toThrow("output limit");
  });
});
