// @vitest-environment node
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  readPublicProduct,
  mapPublicProductSummary,
  publicProductListSelect,
} from "./public-products";
import { GET } from "~/app/sitemap.xml/route";

// No .env, DATABASE_URL or DIRECT_URL fallback. This deliberately supports only
// the dedicated loopback target in docs/seo-launch-plan.md, never the dev DB.
function acceptanceTarget(
  url: string | undefined,
  consent: string | undefined,
) {
  if (consent !== "yes") return undefined;
  try {
    const parsed = new URL(url ?? "");
    const allowed = new Map([
      ["schema", "public"],
      ["connection_limit", "4"],
      ["pool_timeout", "2"],
      ["connect_timeout", "2"],
    ]);
    if (
      parsed.protocol !== "postgresql:" ||
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "55439" ||
      parsed.pathname !== "/darakit_seo_acceptance" ||
      parsed.username !== "seo_acceptance" ||
      !parsed.password ||
      parsed.hash ||
      [...parsed.searchParams].some(
        ([key, value]) => allowed.get(key) !== value,
      ) ||
      new Set(parsed.searchParams.keys()).size !==
        [...parsed.searchParams].length
    )
      throw new Error();
    return parsed.href;
  } catch {
    // Never include the supplied URL or credentials in diagnostics.
    throw new Error(
      "SEO acceptance requires the explicitly confirmed dedicated loopback target",
    );
  }
}
const exampleTarget =
  "postgresql://seo_acceptance:local_test_only@127.0.0.1:55439/darakit_seo_acceptance?schema=public&connection_limit=4&pool_timeout=2&connect_timeout=2";
const target = acceptanceTarget(
  process.env.SEO_TEST_DATABASE_URL,
  process.env.SEO_TEST_DATABASE_DISPOSABLE,
);
const db = target ? new PrismaClient({ datasourceUrl: target }) : undefined;
const binding = vi.hoisted(() => ({
  client: undefined as PrismaClient | undefined,
}));
vi.mock("~/lib/prisma", () => ({
  get prisma() {
    if (!binding.client) throw new Error("SEO acceptance database is disabled");
    return binding.client;
  },
}));

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};
type BatchHook = (tx: Prisma.TransactionClient, batch: number) => Promise<void>;
let beforeBatch: BatchHook | undefined;
let afterBatch: BatchHook | undefined;
let batchArgs: Prisma.ProductFindManyArgs[] = [];
let failure: unknown;

type BatchReadObservation = { batch: number; rows?: number; error?: unknown };
type ReaderTermination = {
  attempts: number;
  pid?: number;
  terminated?: boolean;
  setupError?: unknown;
};
let batchReads: BatchReadObservation[] = [];

// Called only after GET returns, outside the transaction/route catch boundaries.
function assertTerminatedReader(
  termination: ReaderTermination,
  reads: BatchReadObservation[],
  requestFailure: unknown,
) {
  expect(termination.attempts).toBe(1);
  expect(Number.isSafeInteger(termination.pid)).toBe(true);
  expect(termination.pid).toBeGreaterThan(0);
  expect(termination).not.toHaveProperty("setupError");
  expect(termination.terminated).toBe(true);
  expect(reads).toHaveLength(2);
  expect(reads[0]).toEqual({ batch: 1, rows: 500 });
  expect(reads[1]!.batch).toBe(2);
  expect(reads[1]).not.toHaveProperty("rows");
  expect(reads[1]).toHaveProperty("error");
  expect(reads[1]!.error).toBe(requestFailure);
  const connectionFailure =
    requestFailure instanceof Prisma.PrismaClientKnownRequestError
      ? requestFailure.code === "P1017" ||
        (requestFailure.code === "P2010" &&
          requestFailure.meta?.code === "57P01")
      : requestFailure instanceof Prisma.PrismaClientUnknownRequestError &&
        /\b57P01\b/.test(requestFailure.message);
  expect(connectionFailure).toBe(true);
}

// Keep the first failure, including an assertion failure in work, while every
// cleanup stage is attempted. The live caller still awaits the real holder tx.
async function withAcquisitionCleanup(
  work: () => Promise<void>,
  resources: {
    release: () => void;
    holding: Promise<void>;
    disconnect: () => Promise<void>;
    restore: () => void;
  },
) {
  let firstFailure: { error: unknown } | undefined;
  try {
    await work();
  } catch (error) {
    firstFailure = { error };
  } finally {
    try {
      try {
        resources.release();
      } catch (error) {
        firstFailure ??= { error };
      }
      await resources.holding;
    } catch (error) {
      firstFailure ??= { error };
    } finally {
      try {
        await resources.disconnect();
      } catch (error) {
        firstFailure ??= { error };
      } finally {
        try {
          resources.restore();
        } catch (error) {
          firstFailure ??= { error };
        }
      }
    }
  }
  if (firstFailure) throw firstFailure.error;
}

// This is an observation/scheduling boundary, not a database substitute. Every
// query/result, isolation setting, timeout, error and commit uses real Prisma/PG.
// Hooks coordinate another connection or issue real SQL faults on the same tx.
function bindClient(client: PrismaClient) {
  binding.client = new Proxy(client, {
    get(original, key) {
      if (key === "$transaction") {
        return async <T>(
          work: (tx: Prisma.TransactionClient) => Promise<T>,
          options: TransactionOptions,
        ) => {
          try {
            return await original.$transaction(async (tx) => {
              let batch = 0;
              const observed = new Proxy(tx, {
                get(transaction, operation) {
                  if (operation === "product")
                    return new Proxy(transaction.product, {
                      get(model, method) {
                        if (method === "findMany")
                          return async (args: Prisma.ProductFindManyArgs) => {
                            batch++;
                            batchArgs.push(args);
                            await beforeBatch?.(tx, batch);
                            const read: BatchReadObservation = { batch };
                            batchReads.push(read);
                            let rows;
                            try {
                              rows = await transaction.product.findMany(args);
                              read.rows = rows.length;
                            } catch (error) {
                              read.error = error;
                              throw error;
                            }
                            await afterBatch?.(tx, batch);
                            return rows;
                          };
                        const value: unknown = Reflect.get(model, method);
                        return typeof value === "function"
                          ? value.bind(model)
                          : value;
                      },
                    });
                  const value: unknown = Reflect.get(transaction, operation);
                  return typeof value === "function"
                    ? value.bind(transaction)
                    : value;
                },
              });
              return work(observed);
            }, options);
          } catch (error) {
            failure = error;
            throw error;
          }
        };
      }
      const value: unknown = Reflect.get(original, key);
      return typeof value === "function" ? value.bind(original) : value;
    },
  });
}
const locations = (xml: string) =>
  [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]!);
async function unavailable(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("retry-after")).toBe("60");
  expect(response.headers.get("content-type")).toBe(
    "text/plain; charset=utf-8",
  );
  expect(await response.text()).toBe("Sitemap temporarily unavailable");
}
function knownFailure(code: string, postgresCode?: string) {
  expect(failure).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  const error = failure as Prisma.PrismaClientKnownRequestError;
  expect(error.code).toBe(code);
  if (postgresCode) expect(error.meta).toMatchObject({ code: postgresCode });
}
let categoryId: string;
let prefix: string;
const productId = (index: number) =>
  `${prefix}-${String(index).padStart(6, "0")}`;
async function seed(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: productId(index),
    slug: productId(index),
    name: "Synthetic SEO board لوحة",
    price: new Prisma.Decimal("12.50"),
    images: [],
    categoryId,
  }));
  if (rows.length) await db!.product.createMany({ data: rows });
  return rows;
}
afterAll(async () => {
  await db?.$disconnect();
});

describe("SEO PostgreSQL acceptance target safety (offline)", () => {
  it("stays disabled without explicit consent, even when a URL is present", () => {
    expect(acceptanceTarget(undefined, undefined)).toBeUndefined();
    expect(acceptanceTarget(exampleTarget, undefined)).toBeUndefined();
    expect(acceptanceTarget(exampleTarget, "no")).toBeUndefined();
  });
  it("accepts only the dedicated target after opt-in", () => {
    expect(acceptanceTarget(exampleTarget, "yes")).toBe(exampleTarget);
  });
  it.each([
    undefined,
    "invalid-secret-url",
    exampleTarget.replace("127.0.0.1", "production.example.invalid"),
    exampleTarget.replace(":55439", ":5437"),
    exampleTarget.replace("/darakit_seo_acceptance", "/components"),
    exampleTarget.replace("seo_acceptance:", "components:"),
    exampleTarget + "&host=production.example.invalid",
    exampleTarget + "&schema=private",
    exampleTarget + "&connection_limit=4",
  ])(
    "rejects missing, ambiguous or different targets without echoing input (%#)",
    (url) => {
      expect(() => acceptanceTarget(url, "yes")).toThrow(
        "SEO acceptance requires the explicitly confirmed dedicated loopback target",
      );
    },
  );
});

describe("SEO harness failure-path regressions (synthetic, offline)", () => {
  const closedConnection = () =>
    new Prisma.PrismaClientKnownRequestError("Synthetic connection closed", {
      code: "P1017",
      clientVersion: Prisma.prismaVersion.client,
    });
  const terminatedPostgres = () =>
    new Prisma.PrismaClientUnknownRequestError(
      'Synthetic PostgreSQL failure: code: "57P01"',
      { clientVersion: Prisma.prismaVersion.client },
    );
  const termination = (): ReaderTermination => ({
    attempts: 1,
    pid: 12345,
    terminated: true,
  });
  const reads = (error: unknown): BatchReadObservation[] => [
    { batch: 1, rows: 500 },
    { batch: 2, error },
  ];
  it.each([closedConnection, terminatedPostgres])(
    "accepts confirmed setup plus the same native reader connection failure (%#)",
    (createError) => {
      const error = createError();
      expect(() =>
        assertTerminatedReader(termination(), reads(error), error),
      ).not.toThrow();
    },
  );
  it.each([
    "termination returned false",
    "termination SQL rejected",
    "assertion became route failure",
    "unrelated native query failure",
    "second read never started",
    "first batch never completed",
    "transaction failure differs from reader failure",
  ])("rejects a synthetic generic 503 when %s", async (scenario) => {
    const fault = termination();
    const readerError = closedConnection();
    let observed = reads(readerError);
    let requestFailure: unknown = readerError;
    switch (scenario) {
      case "termination returned false":
        fault.terminated = false;
        break;
      case "termination SQL rejected":
        fault.setupError = readerError;
        break;
      case "assertion became route failure":
        requestFailure = new Error("Synthetic swallowed assertion");
        observed = reads(requestFailure);
        break;
      case "unrelated native query failure":
        requestFailure = new Prisma.PrismaClientKnownRequestError(
          "Synthetic timeout",
          { code: "P2028", clientVersion: Prisma.prismaVersion.client },
        );
        observed = reads(requestFailure);
        break;
      case "second read never started":
        observed = observed.slice(0, 1);
        break;
      case "first batch never completed":
        observed[0] = { batch: 1, rows: 0 };
        break;
      case "transaction failure differs from reader failure":
        requestFailure = closedConnection();
        break;
    }
    // The ordinary failure-response assertions alone pass for all these cases.
    await unavailable(
      new Response("Sitemap temporarily unavailable", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "60",
          "Content-Type": "text/plain; charset=utf-8",
        },
      }),
    );
    expect(() =>
      assertTerminatedReader(fault, observed, requestFailure),
    ).toThrow();
  });

  it.each([
    {
      name: "success",
      work: false,
      holder: false,
      disconnect: false,
      restore: false,
    },
    {
      name: "work rejection",
      work: true,
      holder: false,
      disconnect: false,
      restore: false,
    },
    {
      name: "holder rejection",
      work: false,
      holder: true,
      disconnect: false,
      restore: false,
    },
    {
      name: "disconnect rejection",
      work: false,
      holder: false,
      disconnect: true,
      restore: false,
    },
    {
      name: "restore rejection",
      work: false,
      holder: false,
      disconnect: false,
      restore: true,
    },
    {
      name: "work and all cleanup failures",
      work: true,
      holder: true,
      disconnect: true,
      restore: true,
    },
    {
      name: "holder and later cleanup failures",
      work: false,
      holder: true,
      disconnect: true,
      restore: true,
    },
  ])(
    "attempts every cleanup stage and preserves the first failure: $name",
    async (scenario) => {
      const events: string[] = [];
      const workError = new Error("Synthetic work failure");
      const holderError = new Error("Synthetic holder failure");
      const disconnectError = new Error("Synthetic disconnect failure");
      const restoreError = new Error("Synthetic restore failure");
      let settle!: () => void;
      const holding = new Promise<void>((resolve, reject) => {
        settle = () => {
          events.push("holder");
          if (scenario.holder) reject(holderError);
          else resolve();
        };
      });
      const result = withAcquisitionCleanup(
        async () => {
          events.push("work");
          if (scenario.work) throw workError;
        },
        {
          release: () => {
            events.push("release");
            settle();
          },
          holding,
          disconnect: async () => {
            events.push("disconnect");
            if (scenario.disconnect) throw disconnectError;
          },
          restore: () => {
            events.push("restore");
            if (scenario.restore) throw restoreError;
          },
        },
      );
      const expected = scenario.work
        ? workError
        : scenario.holder
          ? holderError
          : scenario.disconnect
            ? disconnectError
            : scenario.restore
              ? restoreError
              : undefined;
      if (expected) await expect(result).rejects.toBe(expected);
      else await expect(result).resolves.toBeUndefined();
      expect(events).toEqual([
        "work",
        "release",
        "holder",
        "disconnect",
        "restore",
      ]);
    },
  );
});

describe
  .skipIf(!db)
  .sequential("SEO real Prisma/PostgreSQL integration acceptance", () => {
    beforeAll(async () => {
      const [identity] = await db!.$queryRaw<
        {
          database: string;
          username: string;
          schema: string;
          version: string;
        }[]
      >`
      SELECT current_database() AS database, current_user AS username,
        current_schema() AS schema, current_setting('server_version') AS version`;
      expect(identity).toMatchObject({
        database: "darakit_seo_acceptance",
        username: "seo_acceptance",
        schema: "public",
      });
      // Fresh isolated DB only. Never clear somebody else's existing catalog.
      expect(await db!.product.count()).toBe(0);
      expect(await db!.category.count()).toBe(0);
      expect(await db!.user.count()).toBe(0);
      expect(await db!.order.count()).toBe(0);
      const migrations = await db!.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
      expect(migrations.map((row) => row.migration_name)).toContain(
        "20261001010000_neutral_sellable_options",
      );
      console.info(
        `SEO acceptance: dedicated loopback PostgreSQL ${identity!.version}; real Prisma; no providers`,
      );
    });
    beforeEach(async () => {
      beforeBatch = afterBatch = undefined;
      batchArgs = [];
      batchReads = [];
      failure = undefined;
      bindClient(db!);
      prefix = `seo-${randomUUID()}`;
      categoryId = (
        await db!.category.create({ data: { name: prefix, slug: prefix } })
      ).id;
    });
    afterEach(async () => {
      beforeBatch = afterBatch = undefined;
      bindClient(db!);
      if (categoryId) {
        await db!.product.deleteMany({ where: { categoryId } });
        await db!.category.delete({ where: { id: categoryId } });
        categoryId = "";
      }
    });

    it("selects active mapped options, serializes decimals/dates and hides exact stock in both DTO shapes", async () => {
      const [row] = await seed(1);
      await db!.product.update({
        where: { id: row!.id },
        data: {
          stock: 987654,
          discountPrice: new Prisma.Decimal("9.25"),
          description: "Real database fixture — لوحة",
          createdAt: new Date("2026-01-02T03:04:05.678Z"),
          variants: {
            create: [
              {
                optionKey: "named:angled",
                optionLabel: "Angled",
                stock: 3,
                sortOrder: 2,
              },
              {
                optionKey: "named:straight",
                optionLabel: "Straight",
                stock: 4,
                sortOrder: 1,
              },
              { optionKey: null, optionLabel: null, stock: 900 },
              {
                optionKey: "named:inconsistent",
                optionLabel: "Different",
                stock: 800,
              },
              { optionKey: "default", stock: 100, isActive: false },
            ],
          },
        },
      });
      const detail = await readPublicProduct(row!.slug);
      expect(detail).toMatchObject({
        price: "12.5",
        discountPrice: "9.25",
        createdAt: "2026-01-02T03:04:05.678Z",
        stock: 7,
        isInStock: true,
        hasVariants: true,
      });
      expect(detail!.variants.map((option) => option.optionLabel)).toEqual([
        "Straight",
        "Angled",
      ]);
      expect(detail).not.toHaveProperty("updatedAt");
      const summary = async () =>
        mapPublicProductSummary(
          await db!.product.findUniqueOrThrow({
            where: { id: row!.id },
            select: publicProductListSelect,
          }),
        );
      expect(await summary()).toMatchObject({
        stock: 7,
        price: "12.5",
        isInStock: true,
      });
      await db!.product.update({
        where: { id: row!.id },
        data: { showStock: false },
      });
      const hidden = await readPublicProduct(row!.slug);
      expect(hidden).toMatchObject({ stock: null, isInStock: true });
      expect(hidden!.variants.every((option) => option.stock === null)).toBe(
        true,
      );
      expect(await summary()).toMatchObject({ stock: null, isInStock: true });
      expect(JSON.stringify(hidden)).not.toMatch(
        /987654|"stock":(?:3|4|7|800|900)/,
      );
    });

    it("ignores legacy stock, sees next-read changes and excludes archived/missing products", async () => {
      const [row] = await seed(1);
      await db!.product.update({
        where: { id: row!.id },
        data: {
          stock: 999,
          variants: { create: { optionKey: "default", stock: 0 } },
        },
      });
      expect(await readPublicProduct(row!.slug)).toMatchObject({
        stock: 0,
        isInStock: false,
        discountPrice: null,
      });
      await db!.productVariant.updateMany({
        where: { productId: row!.id },
        data: { stock: 2 },
      });
      await db!.product.update({
        where: { id: row!.id },
        data: { price: "15.75" },
      });
      expect(await readPublicProduct(row!.slug)).toMatchObject({
        price: "15.75",
        stock: 2,
        isInStock: true,
      });
      await db!.product.update({
        where: { id: row!.id },
        data: { isArchived: true },
      });
      expect(await readPublicProduct(row!.slug)).toBeNull();
      expect(await readPublicProduct("missing-seo-product")).toBeNull();
      expect(await readPublicProduct("../invalid")).toBeNull();
    });

    it.each([0, 499, 500, 501, 1500])(
      "returns a complete uncached sitemap for %i stored rows",
      async (count) => {
        const rows = await seed(count);
        const response = await GET();
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("content-type")).toBe(
          "application/xml; charset=utf-8",
        );
        const urls = locations(await response.text());
        expect(urls.slice(0, 7)).toEqual(
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
        expect(urls.slice(7)).toEqual(
          rows.map((row) => `https://darakit.com/products/${row.slug}`),
        );
        expect(new Set(urls).size).toBe(count + 7);
        expect(batchArgs).toHaveLength(Math.floor(count / 500) + 1);
        for (const [index, args] of batchArgs.entries()) {
          expect(args).toMatchObject({
            select: { id: true, slug: true },
            orderBy: { id: "asc" },
            take: 500,
            where: { isArchived: false },
          });
          expect(args).not.toHaveProperty("skip");
          expect(args.where?.id).toEqual(
            index ? { gt: rows[index * 500 - 1]!.id } : undefined,
          );
        }
      },
    );

    it("advances through an entire invalid-only batch, using exact stored slugs and excluding archives", async () => {
      const rows = await seed(1002);
      await db!.$transaction(
        Array.from({ length: 500 }, (_, index) => {
          const slug =
            index === 0
              ? "x"
              : index === 1
                ? "x".repeat(101)
                : index % 3 === 0
                  ? ` padded-${index} `
                  : index % 3 === 1
                    ? `Upper-${index}`
                    : `لوحة-${index}`;
          rows[index]!.slug = slug;
          return db!.product.update({
            where: { id: rows[index]!.id },
            data: { slug },
          });
        }),
      );
      await db!.product.update({
        where: { id: rows[750]!.id },
        data: { isArchived: true },
      });
      const response = await GET();
      expect(response.status).toBe(200);
      const actual = locations(await response.text()).slice(7);
      expect(actual).toEqual(
        rows
          .filter((_, index) => index >= 500 && index !== 750)
          .map((row) => `https://darakit.com/products/${row.slug}`),
      );
      expect(batchArgs).toHaveLength(3);
      expect(batchArgs[1]!.where?.id).toEqual({ gt: rows[499]!.id });
    }, 20_000);

    it("runs every batch in read-only RepeatableRead with the real 5-second statement limit", async () => {
      await seed(501);
      beforeBatch = async (tx) => {
        const [settings] = await tx.$queryRaw<
          { isolation: string; readonly: string; timeout: string }[]
        >`
        SELECT current_setting('transaction_isolation') AS isolation,
          current_setting('transaction_read_only') AS readonly,
          current_setting('statement_timeout') AS timeout`;
        expect(settings).toEqual({
          isolation: "repeatable read",
          readonly: "on",
          timeout: "5s",
        });
      };
      expect((await GET()).status).toBe(200);
      expect(batchArgs).toHaveLength(2);
    });

    it("PostgreSQL rejects a write in the actual sitemap transaction; failure is uncached 503", async () => {
      const [row] = await seed(1);
      beforeBatch = async (tx) => {
        await tx.product.update({
          where: { id: row!.id },
          data: { name: "Forbidden write" },
        });
      };
      await unavailable(await GET());
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toMatch(/read-only/i);
      expect(
        (await db!.product.findUniqueOrThrow({ where: { id: row!.id } })).name,
      ).toBe(row!.name);
    });

    it("keeps one snapshot during committed create/archive changes across the cursor, then refreshes next request", async () => {
      const rows = await seed(1001);
      const added = [
        { id: `${prefix}-000000-before`, slug: `${prefix}-added-before` },
        { id: `${prefix}-zzzzzz`, slug: `${prefix}-added-after` },
      ];
      afterBatch = async (_tx, batch) => {
        if (batch !== 1) return;
        await db!.$transaction([
          db!.product.updateMany({
            where: { id: { in: [rows[0]!.id, rows[750]!.id] } },
            data: { isArchived: true },
          }),
          db!.product.createMany({
            data: added.map((row) => ({
              ...row,
              name: "Concurrent fixture",
              price: 1,
              images: [],
              categoryId,
            })),
          }),
        ]);
      };
      const first = await GET();
      expect(first.status).toBe(200);
      expect(locations(await first.text()).slice(7)).toEqual(
        rows.map((row) => `https://darakit.com/products/${row.slug}`),
      );
      afterBatch = undefined;
      const fresh = await GET();
      expect(fresh.status).toBe(200);
      const expected = [
        ...rows.filter((_, index) => index !== 0 && index !== 750),
        ...added,
      ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      expect(locations(await fresh.text()).slice(7)).toEqual(
        expected.map((row) => `https://darakit.com/products/${row.slug}`),
      );
    }, 20_000);

    it("discards the first full batch after a later real PostgreSQL statement error", async () => {
      await seed(501);
      beforeBatch = async (tx, batch) => {
        if (batch === 2) await tx.$queryRaw`SELECT 1 / 0 AS fault`;
      };
      await unavailable(await GET());
      expect(batchArgs).toHaveLength(2);
      knownFailure("P2010", "22012");
    });

    it("cancels a later 6-second statement at the unchanged real 5-second timeout", async () => {
      await seed(501);
      beforeBatch = async (tx, batch) => {
        if (batch === 2) await tx.$queryRaw`SELECT pg_sleep(6)::text`;
      };
      await unavailable(await GET());
      expect(batchArgs).toHaveLength(2);
      knownFailure("P2010", "57014");
    }, 20_000);

    it("expires the unchanged 10-second interactive transaction without returning partial XML", async () => {
      await seed(501);
      beforeBatch = async (tx, batch) => {
        if (batch !== 2) return;
        await new Promise((resolve) => setTimeout(resolve, 10_250));
        await tx.$queryRaw`SELECT 1`;
      };
      await unavailable(await GET());
      knownFailure("P2028");
    }, 20_000);

    it("fails uncached when transaction acquisition exceeds the unchanged 2-second maxWait", async () => {
      const singleUrl = new URL(target!);
      singleUrl.searchParams.set("connection_limit", "1");
      // Let the unchanged 2s transaction maxWait expire before the pool's timer.
      singleUrl.searchParams.set("pool_timeout", "10");
      const single = new PrismaClient({ datasourceUrl: singleUrl.href });
      let release!: () => void;
      let ready!: () => void;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const held = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const holding = single.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1`;
          ready();
          await released;
        },
        { timeout: 15_000 },
      );
      await withAcquisitionCleanup(
        async () => {
          await Promise.race([
            held,
            holding.then(() => {
              throw new Error("Pool holder exited unexpectedly");
            }),
          ]);
          bindClient(single);
          const started = performance.now();
          const response = await GET();
          const elapsed = performance.now() - started;
          await unavailable(response);
          knownFailure("P2028");
          expect(failure).toMatchObject({
            meta: { error: "Unable to start a transaction in the given time." },
          });
          expect(batchArgs).toEqual([]);
          expect(elapsed).toBeGreaterThanOrEqual(1_800);
          expect(elapsed).toBeLessThan(8_000);
        },
        {
          release,
          holding,
          disconnect: () => single.$disconnect(),
          restore: () => bindClient(db!),
        },
      );
    }, 20_000);

    it("discards partial XML when PostgreSQL terminates the active reader session, then recovers", async () => {
      await seed(501);
      const termination: ReaderTermination = { attempts: 0 };
      beforeBatch = async (tx, batch) => {
        if (batch !== 2) return;
        termination.attempts++;
        try {
          const [row] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          termination.pid = row!.pid;
          const [result] = await db!.$queryRaw<
            { terminated: boolean }[]
          >`SELECT pg_terminate_backend(${termination.pid}::integer) AS terminated`;
          termination.terminated = result?.terminated;
        } catch (error) {
          termination.setupError = error;
          throw error;
        }
      };
      const response = await GET();
      // None of these assertions can be swallowed by the route's 503 handler.
      assertTerminatedReader(termination, batchReads, failure);
      expect(batchArgs).toHaveLength(2);
      await unavailable(response);
      beforeBatch = undefined;
      expect((await GET()).status).toBe(200);
    }, 20_000);

    it("propagates a real Prisma connection failure and returns uncached 503 for an unavailable endpoint", async () => {
      // A held loopback TCP endpoint resets connections; no PostgreSQL/results shim.
      // This proves transport unavailability, not a Docker/hosted outage rehearsal.
      const endpoint = createServer((socket) => socket.destroy());
      await new Promise<void>((resolve, reject) => {
        endpoint.once("error", reject);
        endpoint.listen(0, "127.0.0.1", resolve);
      });
      const address = endpoint.address();
      if (!address || typeof address === "string")
        throw new Error("Expected loopback TCP endpoint");
      const unavailableUrl = new URL(target!);
      unavailableUrl.port = String(address.port);
      const offline = new PrismaClient({ datasourceUrl: unavailableUrl.href });
      try {
        bindClient(offline);
        await expect(
          readPublicProduct("unavailable-product"),
        ).rejects.toThrow();
        await unavailable(await GET());
      } finally {
        await offline.$disconnect();
        await new Promise<void>((resolve, reject) =>
          endpoint.close((error) => (error ? reject(error) : resolve())),
        );
        bindClient(db!);
      }
      expect((await GET()).status).toBe(200);
    }, 20_000);
  });
