import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rateLimit: vi.fn(),
  validateSameOriginRequest: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    category: {
      findUnique: vi.fn(),
    },
    product: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("~/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("~/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("~/lib/csrf", () => ({
  validateSameOriginRequest: mocks.validateSameOriginRequest,
}));

vi.mock("~/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET, POST } from "./route";

const categoryId = "clh1q2w3e000008l4a5b6c7d8";

function createGetRequest(query = "") {
  return new Request(`http://localhost:3000/api/admin/products${query}`);
}

function createPostRequest(body: unknown) {
  return new Request("http://localhost:3000/api/admin/products", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

describe("admin product collection route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback(mocks.prisma),
    );
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ total: 1n }])
      .mockResolvedValueOnce([{ id: "product-1" }]);

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    });

    mocks.rateLimit.mockResolvedValue({
      ok: true,
    });

    mocks.validateSameOriginRequest.mockReturnValue(null);
  });

  it("loads filtered products for admins", async () => {
    mocks.prisma.product.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        name: "Figure",
        slug: "figure",
        description: null,
        price: new Prisma.Decimal("19.99"),
        discountPrice: new Prisma.Decimal("14.99"),
        stock: 3,
        images: [],
        isArchived: false,
        isFeatured: false,
        showStock: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        category: {
          id: categoryId,
          name: "Figures",
          slug: "figures",
        },
        variants: [],
      },
    ]);

    const response = await GET(
      createGetRequest(
        `?q=fig&categoryId=${categoryId}&status=active&stock=low_stock&sort=stock_asc&page=1&limit=10`,
      ),
    );
    const body = (await response.json()) as {
      products: Array<{
        slug: string;
        price: string;
        discountPrice: string | null;
      }>;
      pagination: { total: number; page: number; limit: number };
      summary: { activeProducts: number; archivedProducts: number };
    };

    expect(response.status).toBe(200);
    expect(body.products[0]?.slug).toBe("figure");
    expect(body.products[0]?.price).toBe("19.99");
    expect(body.products[0]?.discountPrice).toBe("14.99");
    expect(body.pagination.total).toBe(1);
    expect(body.summary.activeProducts).toBe(4);
    expect(body.summary.archivedProducts).toBe(2);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["product-1"] } },
      }),
    );
  });

  it("preserves aggregate ordering when hydration returns rows in reverse order", async () => {
    mocks.prisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ total: 3n }])
      .mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    const product = (id: string) => ({
      id,
      stock: 999,
      price: new Prisma.Decimal(10),
      discountPrice: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      variants: [],
    });
    mocks.prisma.product.findMany.mockResolvedValue([
      product("b"),
      product("a"),
    ]);
    mocks.prisma.product.count.mockResolvedValue(3);
    const response = await GET(createGetRequest("?sort=stock_desc&limit=2"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.products.map((p: { id: string }) => p.id)).toEqual(["a", "b"]);
    expect(body.products[0].stock).toBe(999); // Preserve response shape/legacy field.
    expect(body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["a", "b"] } },
      }),
    );
  });

  it.each([0n, 5n])(
    "retains filtered count %s for an empty page without hydrating",
    async (total) => {
      mocks.prisma.$queryRaw
        .mockReset()
        .mockResolvedValueOnce([{ total }])
        .mockResolvedValueOnce([]);
      mocks.prisma.product.count.mockResolvedValue(10);
      const response = await GET(
        createGetRequest("?page=4&limit=2&stock=low_stock"),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.products).toEqual([]);
      expect(body.pagination).toEqual({
        page: 4,
        limit: 2,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / 2)),
      });
      expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid product filters", async () => {
    const response = await GET(createGetRequest("?status=deleted&limit=500"));
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid filters.");
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("creates a product with valid input", async () => {
    mocks.prisma.category.findUnique.mockResolvedValue({ id: categoryId });
    mocks.prisma.product.create.mockResolvedValue({
      id: "product-1",
      name: "Figure",
      slug: "figure",
      description: null,
      price: new Prisma.Decimal("19.99"),
      discountPrice: new Prisma.Decimal("14.99"),
      stock: 3,
      images: [],
      isArchived: false,
      isFeatured: false,
      showStock: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      category: {
        id: categoryId,
        name: "Figures",
        slug: "figures",
      },
      variants: [],
    });

    const response = await POST(
      createPostRequest({
        name: "Figure",
        slug: "figure",
        description: null,
        price: "19.99",
        discountPrice: "14.99",
        stock: "3",
        images: [],
        isFeatured: false,
        showStock: false,
        categoryId,
      }),
    );
    const body = (await response.json()) as {
      product: {
        slug: string;
        discountPrice: string | null;
        showStock: boolean;
      };
    };

    expect(response.status).toBe(201);
    expect(body.product.slug).toBe("figure");
    expect(body.product.discountPrice).toBe("14.99");
    expect(body.product.showStock).toBe(false);
    expect(mocks.prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountPrice: 14.99,
          showStock: false,
        }),
      }),
    );
  });

  it("hides the route from non-admin users", async () => {
    const notFoundResponse = Response.json(
      {
        message: "Not found.",
      },
      { status: 404 },
    );

    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: notFoundResponse,
    });

    const response = await GET(createGetRequest());
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(404);
    expect(body.message).toBe("Not found.");
  });
});
