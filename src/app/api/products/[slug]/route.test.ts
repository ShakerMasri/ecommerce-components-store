import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  productFindFirst: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("~/lib/prisma", () => ({
  prisma: {
    product: {
      findFirst: mocks.productFindFirst,
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
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    price: string;
    discountPrice: string | null;
    stock: number | null;
    isInStock: boolean;
    showStock: boolean;
    images: string[];
    isFeatured: boolean;
    hasVariants: boolean;
    variants: Array<{
      id: string;
      sizeLabel: string | null;
      colorLabel: string | null;
      stock: number | null;
      isInStock: boolean;
      sortOrder: number;
    }>;
    category: ProductCategory;
  };
};

type ErrorResponse = {
  message: string;
};

function createRequest(path: string) {
  return new Request(`http://localhost:3000${path}`);
}

function createSlugParams(slug: string) {
  return {
    params: Promise.resolve({ slug }),
  };
}

describe("GET /api/products/[slug]", () => {
  const category: ProductCategory = {
    id: "category-1",
    name: "Figures",
    slug: "figures",
  };

  const product = {
    id: "product-1",
    name: "Test Product",
    slug: "test-product",
    description: "A test product",
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
        id: "variant-1",
        optionKey: "named:m / black",
        optionLabel: "M / Black",
        sizeLabel: "M",
        colorLabel: "Black",
        stock: 5,
        sortOrder: 0,
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    category,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindFirst.mockResolvedValue(product);
    mocks.rateLimit.mockResolvedValue({ ok: true });
  });

  it("returns product by slug", async () => {
    const request = createRequest("/api/products/test-product");
    const response = await GET(request, createSlugParams("test-product"));
    const body = (await response.json()) as ProductResponse;

    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledWith(request, "publicRead");
    expect(body.product.name).toBe("Test Product");
    expect(body.product.slug).toBe("test-product");
    expect(body.product.price).toBe("99.99");
    expect(body.product.discountPrice).toBe("79.99");
    expect(body.product.stock).toBeNull();
    expect(body.product.isInStock).toBe(true);
    expect(body.product.variants[0]?.stock).toBeNull();
    expect(body.product.variants[0]?.isInStock).toBe(true);
    expect(body.product.showStock).toBe(false);
    expect(body.product.hasVariants).toBe(true);
  });

  it("returns 429 when the public read rate limit is exceeded", async () => {
    mocks.rateLimit.mockResolvedValue({
      ok: false,
      response: Response.json(
        { message: "Too many requests." },
        { status: 429 },
      ),
    });

    const response = await GET(
      createRequest("/api/products/test-product"),
      createSlugParams("test-product"),
    );
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(429);
    expect(body.message).toBe("Too many requests.");
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
  });

  it("returns exact option stock only when stock visibility is enabled", async () => {
    mocks.productFindFirst.mockResolvedValue({
      ...product,
      showStock: true,
      variants: [
        {
          id: "variant-1",
          optionKey: "named:m / black",
          optionLabel: "M / Black",
          sizeLabel: "M",
          colorLabel: "Black",
          stock: 5,
          sortOrder: 0,
        },
      ],
    });

    const response = await GET(
      createRequest("/api/products/test-product"),
      createSlugParams("test-product"),
    );
    const body = (await response.json()) as ProductResponse;

    expect(response.status).toBe(200);
    expect(body.product.stock).toBe(5);
    expect(body.product.variants[0]?.stock).toBe(5);
  });

  it("only returns non-archived product with matching slug", async () => {
    await GET(
      createRequest("/api/products/test-product"),
      createSlugParams("test-product"),
    );

    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: "test-product",
          isArchived: false,
        },
        select: expect.objectContaining({
          discountPrice: true,
          showStock: true,
          _count: expect.any(Object),
          variants: expect.any(Object),
        }),
      }),
    );
  });

  it("returns 400 for invalid slug", async () => {
    const response = await GET(
      createRequest("/api/products/Invalid Slug!"),
      createSlugParams("Invalid Slug!"),
    );
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid product slug.");
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when product does not exist", async () => {
    mocks.productFindFirst.mockResolvedValue(null);

    const response = await GET(
      createRequest("/api/products/missing-product"),
      createSlugParams("missing-product"),
    );
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(404);
    expect(body.message).toBe("Product not found.");
  });

  it("returns 500 if product fails to load", async () => {
    mocks.productFindFirst.mockRejectedValue(new Error("Database error"));

    const response = await GET(
      createRequest("/api/products/test-product"),
      createSlugParams("test-product"),
    );
    const body = (await response.json()) as ErrorResponse;

    expect(response.status).toBe(500);
    expect(body.message).toBe("Failed to load product.");
  });
});
