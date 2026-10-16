// @vitest-environment node
import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { getEffectiveProductPrice } from "~/server/pricing";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  rateLimit: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    product: { update: vi.fn() },
    category: { findUnique: vi.fn() },
  },
}));
vi.mock("~/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("~/lib/admin", () => ({ requireAdmin: mocks.admin }));
vi.mock("~/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
import { PATCH } from "./route";

const context = { params: Promise.resolve({ id: "product" }) };
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/admin/products/product", {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const initialProduct = () => ({
  id: "product",
  name: "Sensor",
  price: new Prisma.Decimal(100),
  discountPrice: new Prisma.Decimal(40) as Prisma.Decimal | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  variants: [],
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ ok: true, user: { id: "admin" } });
  mocks.rateLimit.mockResolvedValue({ ok: true });
});

it.each(["price", "discount"])(
  "serializes overlapping partial edits with %s first (modeled row locks)",
  async (first) => {
    let product = initialProduct();
    let tail = Promise.resolve();
    const writing = deferred();
    const secondAttempted = deferred();
    const releaseWrite = deferred();
    let attempts = 0;
    const writes: unknown[] = [];
    const queries: Prisma.Sql[] = [];
    mocks.prisma.$transaction.mockImplementation(async (run) => {
      let unlock: (() => void) | undefined;
      const tx = {
        $queryRaw: async (query: Prisma.Sql) => {
          queries.push(query);
          const previous = tail;
          const released = deferred();
          tail = released.promise;
          if (++attempts === 2) secondAttempted.resolve();
          await previous;
          unlock = released.resolve;
          return [
            { price: product.price, discountPrice: product.discountPrice },
          ];
        },
        product: {
          update: async ({
            data,
          }: {
            data: { price?: number; discountPrice?: number | null };
          }) => {
            writing.resolve();
            await releaseWrite.promise;
            writes.push(data);
            product = {
              ...product,
              price:
                data.price === undefined
                  ? product.price
                  : new Prisma.Decimal(data.price),
              discountPrice:
                data.discountPrice === undefined
                  ? product.discountPrice
                  : data.discountPrice === null
                    ? null
                    : new Prisma.Decimal(data.discountPrice),
            };
            return product;
          },
        },
      };
      try {
        return await run(tx);
      } finally {
        unlock?.();
      }
    });
    const edits =
      first === "price"
        ? [{ price: 50 }, { discountPrice: 90 }]
        : [{ discountPrice: 90 }, { price: 50 }];
    const one = PATCH(request(edits[0]), context);
    await writing.promise;
    const two = PATCH(request(edits[1]), context);
    await secondAttempted.promise;
    expect(writes).toHaveLength(0);
    releaseWrite.resolve();
    const responses = await Promise.all([one, two]);
    expect(responses.map((response) => response.status)).toEqual([200, 400]);
    expect(writes).toHaveLength(1);
    expect(product.discountPrice!.lt(product.price)).toBe(true);
    expect(getEffectiveProductPrice(product).toNumber()).toBe(
      first === "price" ? 40 : 90,
    );
    for (const query of queries) {
      expect(query.sql).toContain(
        'SELECT "price", "discountPrice" FROM "Product"',
      );
      expect(query.sql).toContain("FOR NO KEY UPDATE");
      expect(query.values).toEqual(["product"]);
    }
    expect(mocks.prisma.product.update).not.toHaveBeenCalled();
  },
);

it.each([
  [{ price: 40 }, 400],
  [{ discountPrice: 100 }, 400],
  [{ discountPrice: null, price: 30 }, 200],
  [{ price: 50, discountPrice: 20 }, 200],
  [{ discountPrice: 0 }, 400],
  [{ discountPrice: 0.01 }, 200],
  [{ name: "New sensor" }, 200],
] as const)(
  "validates and writes %j inside the transaction",
  async (data, status) => {
    const product = initialProduct();
    const query = vi.fn().mockResolvedValue([product]);
    const update = vi.fn().mockResolvedValue(product);
    mocks.prisma.$transaction.mockImplementation((run) =>
      run({ $queryRaw: query, product: { update } }),
    );
    expect((await PATCH(request(data), context)).status).toBe(status);
    expect(update).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
    if (status === 200)
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "product" }, data }),
      );
    if ("name" in data) expect(query).not.toHaveBeenCalled();
  },
);

it("returns missing and database failure responses without a fallback write", async () => {
  const update = vi.fn();
  mocks.prisma.$transaction.mockImplementation((run) =>
    run({ $queryRaw: async () => [], product: { update } }),
  );
  expect((await PATCH(request({ price: 50 }), context)).status).toBe(404);
  expect(update).not.toHaveBeenCalled();
  mocks.prisma.$transaction.mockRejectedValue(new Error("transaction failed"));
  expect((await PATCH(request({ price: 50 }), context)).status).toBe(500);
  expect(mocks.prisma.product.update).not.toHaveBeenCalled();
});

it("retains admin, origin, rate and input rejection before transactions", async () => {
  mocks.admin.mockResolvedValueOnce({
    ok: false,
    response: Response.json({}, { status: 403 }),
  });
  expect((await PATCH(request({ price: 50 }), context)).status).toBe(403);
  expect(
    (await PATCH(request({ price: 50 }, "https://foreign.invalid"), context))
      .status,
  ).toBe(403);
  mocks.rateLimit.mockResolvedValueOnce({
    ok: false,
    response: Response.json({}, { status: 429 }),
  });
  expect((await PATCH(request({ price: 50 }), context)).status).toBe(429);
  expect((await PATCH(request({ price: -1 }), context)).status).toBe(400);
  expect((await PATCH(request({}), context)).status).toBe(400);
  expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
});
