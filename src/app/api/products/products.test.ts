import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("~/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: mocks.productFindMany,
    },
    category: {
      findMany: mocks.categoryFindMany,
    },
  },
}));

vi.mock("~/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

type ProductCategory = {
  id: string;
  name: string;
  slug: string;
};

type ProductResponse = {
  products: Array<{
    id: string;
    name: string;
    slug: string;
    price: string;
    discountPrice: string | null;
    stock: number | null;
    isInStock: boolean;
    showStock: boolean;
    images: string[];
    isFeatured: boolean;
    hasVariants: boolean;
    category: ProductCategory;
  }>;
  categories: ProductCategory[];
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    nextPage: number | null;
  };
};

type ErrorResponse = {
  message: string;
};

function createRequest(path: string) {
  return new Request(`http://localhost:3000${path}`);
}

describe("GET /api/products", () => {
  const categories: ProductCategory[] = [
    {
      id: "category-1",
      name: "Suits",
      slug: "suits",
    },
  ];

  const products = [
    {
      id: "product-1",
      name: "Test Product",
      slug: "test-product",
      price: {
        toString: () => "99.99",
      },
      discountPrice: {
        toString: () => "79.99",
      },
      showStock: false,
      _count: {
        variants: 1,
      },
      images: ["https://res.cloudinary.com/demo/image/upload/test.jpg"],
      isFeatured: true,
      variants: [
        {
          optionKey: "named:pins",
          optionLabel: "Pins",
          stock: 10,
        },
      ],
      category: categories[0],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.productFindMany.mockResolvedValue(products);
    mocks.categoryFindMany.mockResolvedValue(categories);
    mocks.rateLimit.mockResolvedValue({ ok: true });
  });

  it("returns the first capped page of products and categories", async () => {
    const request = createRequest("/api/products");
    const response = await GET(request);
    const body = (await response.json()) as ProductResponse;

    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledWith(request, "publicRead");
    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isArchived: false,
        },
        skip: 0,
        take: 13,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        select: expect.objectContaining({
          discountPrice: true,
          showStock: true,
          _count: expect.any(Object),
          variants: expect.any(Object),
        }),
      }),
    );
    expect(body.products).toHaveLength(1);
    expect(body.categories).toHaveLength(1);
    expect(body.products[0]?.name).toBe("Test Product");
    expect(body.products[0]?.price).toBe("99.99");
    expect(body.products[0]?.discountPrice).toBe("79.99");
    expect(body.products[0]?.stock).toBeNull();
    expect(body.products[0]?.isInStock).toBe(true);
    expect(body.products[0]?.showStock).toBe(false);
    expect(body.products[0]?.hasVariants).toBe(true);
    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 12,
      hasMore: false,
      nextPage: null,
    });
  });

  it("returns 429 when the public read rate limit is exceeded", async () => {
    mocks.rateLimit.mockResolvedValue({
      ok: false,
      response: Response.json(
        { message: "Too many requests." },
        { status: 429 },
      ),
    });

    const response = await GET(createRequest("/api/products"));
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(429);
    expect(body.message).toBe("Too many requests.");
    expect(mocks.productFindMany).not.toHaveBeenCalled();
    expect(mocks.categoryFindMany).not.toHaveBeenCalled();
  });

  it("returns exact stock only when stock visibility is enabled", async () => {
    mocks.productFindMany.mockResolvedValue([
      {
        ...products[0],
        showStock: true,
        variants: [
          { optionKey: "named:a", optionLabel: "A", stock: 3 },
          { optionKey: "named:b", optionLabel: "B", stock: 4 },
        ],
      },
    ]);

    const response = await GET(createRequest("/api/products"));
    const body = (await response.json()) as ProductResponse;

    expect(response.status).toBe(200);
    expect(body.products[0]?.stock).toBe(7);
    expect(body.products[0]?.isInStock).toBe(true);
  });

  it("filters products by category slug", async () => {
    await GET(createRequest("/api/products?category=suits"));

    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isArchived: false,
          category: {
            slug: "suits",
          },
        },
      }),
    );
  });

  it("searches products server-side by product or category name", async () => {
    await GET(createRequest("/api/products?search=linen%20suit"));

    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isArchived: false,
          OR: [
            {
              name: {
                contains: "linen suit",
                mode: "insensitive",
              },
            },
            {
              category: {
                name: {
                  contains: "linen suit",
                  mode: "insensitive",
                },
              },
            },
          ],
        }),
      }),
    );
  });

  it("uses validated page and capped pageSize query parameters", async () => {
    const response = await GET(
      createRequest("/api/products?page=3&pageSize=500"),
    );
    const body = (await response.json()) as ProductResponse;

    expect(response.status).toBe(200);
    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 48,
        take: 25,
      }),
    );
    expect(body.pagination.page).toBe(3);
    expect(body.pagination.pageSize).toBe(24);
  });

  it("trims one extra product from the response to determine hasMore", async () => {
    mocks.productFindMany.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => ({
        ...products[0],
        id: `product-${index + 1}`,
        slug: `test-product-${index + 1}`,
      })),
    );

    const response = await GET(createRequest("/api/products"));
    const body = (await response.json()) as ProductResponse;

    expect(response.status).toBe(200);
    expect(body.products).toHaveLength(12);
    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 12,
      hasMore: true,
      nextPage: 2,
    });
  });

  it("returns 400 for invalid query parameters", async () => {
    const response = await GET(
      createRequest("/api/products?category=Invalid Category!&page=abc"),
    );
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid query parameters.");
    expect(mocks.productFindMany).not.toHaveBeenCalled();
    expect(mocks.categoryFindMany).not.toHaveBeenCalled();
  });

  it("returns 400 for an overly long search query", async () => {
    const response = await GET(
      createRequest(`/api/products?search=${"a".repeat(81)}`),
    );
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid query parameters.");
    expect(mocks.productFindMany).not.toHaveBeenCalled();
    expect(mocks.categoryFindMany).not.toHaveBeenCalled();
  });

  it("returns 500 if products fail to load", async () => {
    mocks.productFindMany.mockRejectedValue(new Error("Database error"));

    const response = await GET(createRequest("/api/products"));
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(500);
    expect(body.message).toBe("Failed to load products.");
  });
});
