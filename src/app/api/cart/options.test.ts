import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  csrf: vi.fn(),
  rateLimit: vi.fn(),
  prisma: {
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    cartItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
}));
vi.mock("~/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("~/server/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/csrf", () => ({ validateSameOriginRequest: mocks.csrf }));
vi.mock("~/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
import { POST } from "./items/route";
import { PATCH, DELETE } from "./items/[id]/route";
import { GET } from "./route";

const productId = "clh1q2w3e000008l4a5b6c7d8";
const a = "clh1q2w3e000108l4a5b6c7d9";
const b = "clh1q2w3e000208l4a5b6c7e0";
const context = { params: Promise.resolve({ id: a }) };
const options = [
  {
    id: a,
    productId,
    optionLabel: "Straight pins",
    optionKey: "named:straight pins",
    stock: 3,
    isActive: true,
  },
  {
    id: b,
    productId,
    optionLabel: "Angled pins",
    optionKey: "named:angled pins",
    stock: 7,
    isActive: true,
  },
];
const request = (body: unknown) =>
  new Request("http://localhost:3000/api/cart/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.csrf.mockReturnValue(null);
  mocks.rateLimit.mockResolvedValue({ ok: true });
  mocks.prisma.$transaction.mockImplementation(
    (run: (tx: typeof mocks.prisma) => Promise<unknown>) => run(mocks.prisma),
  );
  mocks.prisma.product.findUnique.mockResolvedValue({
    id: productId,
    isArchived: false,
    variants: options,
  });
  mocks.prisma.cartItem.findUnique.mockResolvedValue(null);
  mocks.prisma.cartItem.create.mockImplementation(
    ({ data }: { data: unknown }) => data,
  );
});
describe("neutral persisted cart selection", () => {
  it("caps repeated additions at 99 and permits an owned reduction and refill", async () => {
    const variant = { ...options[0]!, stock: 1000 };
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: productId,
      isArchived: false,
      variants: [variant],
    });
    let quantity = 0;
    mocks.prisma.cartItem.findUnique.mockImplementation(async () =>
      quantity ? { id: a, quantity } : null,
    );
    mocks.prisma.cartItem.create.mockImplementation(async ({ data }) => {
      quantity = data.quantity;
      return { id: a, ...data };
    });
    mocks.prisma.cartItem.update.mockImplementation(async ({ data }) => {
      quantity = data.quantity;
      return { id: a, quantity };
    });
    const add = (amount: number) =>
      POST(request({ productId, productVariantId: a, quantity: amount }));
    expect((await add(100)).status).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect((await add(98)).status).toBe(200);
    expect((await add(1)).status).toBe(200);
    expect(quantity).toBe(99);
    for (const amount of [1, 99]) {
      expect((await add(amount)).status).toBe(400);
      expect(quantity).toBe(99);
    }
    mocks.prisma.cartItem.findFirst.mockImplementation(async () => ({
      id: a,
      quantity,
      productVariantId: a,
      productVariant: variant,
      product: { id: productId, isArchived: false },
    }));
    mocks.prisma.cartItem.updateMany.mockImplementation(async ({ data }) => {
      quantity = data.quantity;
      return { count: 1 };
    });
    expect((await PATCH(request({ quantity: 100 }), context)).status).toBe(400);
    for (const amount of [99, 98, 1]) {
      const response = await PATCH(request({ quantity: amount }), context);
      expect(response.status).toBe(200);
      expect((await response.json()).cartItem.quantity).toBe(amount);
    }
    expect((await add(98)).status).toBe(200);
    expect(quantity).toBe(99);
    expect(mocks.prisma.cartItem.findUnique).toHaveBeenCalledWith({
      where: {
        userId_cartLineKey: { userId: "owner", cartLineKey: `variant:${a}` },
      },
    });
    expect(mocks.prisma.cartItem.updateMany).toHaveBeenCalledWith({
      where: { id: a, userId: "owner" },
      data: { quantity: 1 },
    });
    expect(mocks.prisma.$executeRaw).toHaveBeenCalledTimes(8);
    expect(mocks.prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.prisma.product.findUnique.mock.invocationCallOrder[0]!,
    );
  });

  it("still checks accumulated stock below the quantity limit", async () => {
    mocks.prisma.cartItem.findUnique.mockResolvedValue({ id: a, quantity: 3 });
    expect(
      (await POST(request({ productId, productVariantId: a, quantity: 1 })))
        .status,
    ).toBe(400);
    expect(mocks.prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it("removes only an owned line and preserves the already-absent 404 response", async () => {
    mocks.prisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 1 });
    expect((await DELETE(request(null), context)).status).toBe(200);
    expect(mocks.prisma.cartItem.deleteMany.mock.calls[0]![0].where).toEqual({
      id: a,
      userId: "owner",
    });
    mocks.prisma.cartItem.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect((await DELETE(request(null), context)).status).toBe(404);
  });
  it("persists two choices by stable variant ID without mixing quantities or stock", async () => {
    for (const id of [a, b])
      expect(
        (await POST(request({ productId, productVariantId: id, quantity: 2 })))
          .status,
      ).toBe(200);
    expect(
      mocks.prisma.cartItem.create.mock.calls.map((call) => call[0].data),
    ).toEqual([
      {
        userId: "owner",
        productId,
        productVariantId: a,
        cartLineKey: `variant:${a}`,
        quantity: 2,
      },
      {
        userId: "owner",
        productId,
        productVariantId: b,
        cartLineKey: `variant:${b}`,
        quantity: 2,
      },
    ]);
    expect(
      (await POST(request({ productId, productVariantId: a, quantity: 4 })))
        .status,
    ).toBe(400);
    expect(
      (await POST(request({ productId, productVariantId: b, quantity: 4 })))
        .status,
    ).toBe(200);
  });
  it("uses the default ID without a product-only cart line", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: productId,
      variants: [{ ...options[0], optionKey: "default", optionLabel: null }],
    });
    expect(
      (await POST(request({ productId, productVariantId: a, quantity: 1 })))
        .status,
    ).toBe(200);
    expect(
      mocks.prisma.cartItem.create.mock.calls[0]![0].data.cartLineKey,
    ).toBe(`variant:${a}`);
  });
  it.each(["inactive", "foreign", "unmapped", "missing"])(
    "rejects %s options",
    async (kind) => {
      const catalog =
        kind === "missing"
          ? []
          : [
              {
                ...options[0]!,
                ...(kind === "unmapped"
                  ? { optionKey: null, optionLabel: null }
                  : {}),
                ...(kind === "inactive" ? { isActive: false } : {}),
                ...(kind === "foreign" ? { productId: b } : {}),
              },
            ];
      mocks.prisma.product.findUnique.mockImplementation(
        ({
          where,
          select,
        }: {
          where: { id: string };
          select: { variants: { where: { isActive: boolean } } };
        }) => ({
          id: productId,
          variants: catalog.filter(
            (v) =>
              v.productId === where.id &&
              v.isActive === select.variants.where.isActive,
          ),
        }),
      );
      expect(
        (await POST(request({ productId, productVariantId: a, quantity: 1 })))
          .status,
      ).toBe(400);
      expect(
        mocks.prisma.product.findUnique.mock.calls[0]![0].select.variants.where,
      ).toEqual({ isActive: true });
      expect(mocks.prisma.cartItem.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    { ...options[0], isActive: false },
    { ...options[0], productId: b },
    { ...options[0], optionKey: null, optionLabel: null },
  ])(
    "rejects stale cart updates without reinterpreting identity",
    async (option) => {
      mocks.prisma.cartItem.findFirst.mockResolvedValue({
        id: a,
        productVariantId: option ? a : null,
        productVariant: option,
        product: { id: productId, isArchived: false },
      });
      expect((await PATCH(request({ quantity: 1 }), context)).status).toBe(400);
      expect(mocks.prisma.cartItem.findFirst.mock.calls[0]![0].where).toEqual({
        id: a,
        userId: "owner",
      });
      expect(mocks.prisma.cartItem.updateMany).not.toHaveBeenCalled();
    },
  );
  it("returns unresolved cart selections as explicitly unavailable", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ name: "Test" });
    mocks.prisma.cartItem.findMany.mockResolvedValue([
      {
        id: a,
        quantity: 1,
        productVariantId: a,
        productVariant: { ...options[0], optionKey: null, optionLabel: null },
        product: {
          id: productId,
          price: new Prisma.Decimal(10),
          discountPrice: null,
          variants: options,
          _count: { variants: 2 },
          showStock: true,
          category: {},
        },
      },
    ]);
    const body = await (await GET()).json();
    expect(body.cartItems[0]).toMatchObject({
      productVariantId: a,
      productVariant: null,
      isAvailable: false,
      hasEnoughStock: false,
      availableStock: 0,
    });
  });
  it("stops before writes for missing authentication, CSRF or abuse protection", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(
      (await POST(request({ productId, productVariantId: a, quantity: 1 })))
        .status,
    ).toBe(401);
    mocks.auth.mockResolvedValue({ user: { id: "owner" } });
    mocks.csrf.mockReturnValue(Response.json({}, { status: 403 }));
    expect(
      (await POST(request({ productId, productVariantId: a, quantity: 1 })))
        .status,
    ).toBe(403);
    mocks.csrf.mockReturnValue(null);
    mocks.rateLimit.mockResolvedValue({
      ok: false,
      response: Response.json({}, { status: 429 }),
    });
    expect(
      (await POST(request({ productId, productVariantId: a, quantity: 1 })))
        .status,
    ).toBe(429);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
