import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  csrf: vi.fn(),
  rateLimit: vi.fn(),
  prisma: {
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
      findUniqueOrThrow: vi.fn(),
    },
  },
}));
vi.mock("~/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("~/server/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/csrf", () => ({ validateSameOriginRequest: mocks.csrf }));
vi.mock("~/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
import { POST } from "./items/route";
import { PATCH } from "./items/[id]/route";
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
