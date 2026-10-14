import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { readPublicProduct, publicProductListSelect } from "./public-products";
import { GET as detailApi } from "~/app/api/products/[slug]/route";
import { GET as listApi } from "~/app/api/products/route";
import ProductPage, { generateMetadata } from "~/app/products/[slug]/page";
import {
  productDescriptionSnippet,
  parseProductDescription,
} from "~/lib/product-description";
import { type PublicProduct } from "~/lib/public-product";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("~/lib/prisma", () => ({
  prisma: {
    product: { findFirst: mocks.findFirst, findMany: mocks.findMany },
    category: { findMany: async () => [] },
  },
}));
vi.mock("~/lib/rate-limit", () => ({ rateLimit: mocks.limit }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

const variant = {
  id: "stable-default",
  optionKey: "default",
  optionLabel: null,
  sizeLabel: null,
  colorLabel: null,
  stock: 738291,
  sortOrder: 0,
};
const record = {
  id: "public-product",
  name: "Synthetic board",
  slug: "synthetic-board",
  description: "A local fixture.",
  price: new Prisma.Decimal("25.50"),
  discountPrice: new Prisma.Decimal("20"),
  images: ["https://example.invalid/board.png"],
  isFeatured: false,
  showStock: false,
  createdAt: new Date("2026-10-13T00:00:00Z"),
  category: { id: "category", name: "Components", slug: "components" },
  variants: [variant],
  stock: 999999,
  privateField: "must-not-serialize",
};
const props = { params: Promise.resolve({ slug: record.slug }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue(record);
  mocks.findMany.mockResolvedValue([record]);
  mocks.limit.mockResolvedValue({ ok: true });
});

describe("public product reader/page/API integration with synthetic Prisma results", () => {
  it("serializes only the safe contract and reuses listing mapping without full list records", async () => {
    const detail = await detailApi(
      new Request("http://localhost/api/products/synthetic-board"),
      props,
    );
    const { product } = (await detail.json()) as { product: PublicProduct };
    const list = await listApi(new Request("http://localhost/api/products"));
    const { products } = (await list.json()) as { products: PublicProduct[] };
    expect(product).toMatchObject({
      price: "25.5",
      discountPrice: "20",
      stock: null,
      isInStock: true,
      createdAt: record.createdAt.toISOString(),
    });
    expect(product.variants[0]).toMatchObject({
      id: "stable-default",
      stock: null,
      isInStock: true,
    });
    for (const key of [
      "stock",
      "isInStock",
      "hasVariants",
      "price",
      "discountPrice",
      "category",
    ] as const)
      expect(products[0]?.[key]).toEqual(product[key]);
    expect(JSON.stringify(product)).not.toMatch(
      /738291|999999|privateField|must-not-serialize/,
    );
    expect(publicProductListSelect).not.toHaveProperty("description");
    expect(publicProductListSelect.variants.select).not.toHaveProperty("id");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: record.slug, isArchived: false },
      }),
    );
    expect(mocks.findFirst.mock.calls[0]?.[0].select).not.toHaveProperty(
      "stock",
    );
  });

  it.each([
    { label: "default", variants: [variant], inStock: true, named: false },
    {
      label: "sold out",
      variants: [{ ...variant, stock: 0 }],
      inStock: false,
      named: false,
    },
    {
      label: "mixed named",
      variants: [
        {
          ...variant,
          optionKey: "named:straight",
          optionLabel: "Straight",
          stock: 0,
        },
        {
          ...variant,
          id: "stable-angled",
          optionKey: "named:angled",
          optionLabel: "Angled",
          stock: 3,
        },
      ],
      inStock: true,
      named: true,
    },
    {
      label: "unmapped only",
      variants: [{ ...variant, optionKey: null }],
      inStock: false,
      named: false,
    },
    {
      label: "zero active options",
      variants: [],
      inStock: false,
      named: false,
    },
  ])(
    "agrees across page seed/API/list for $label",
    async ({ variants, inStock, named }) => {
      mocks.findFirst.mockResolvedValue({
        ...record,
        variants,
        showStock: true,
      });
      mocks.findMany.mockResolvedValue([
        { ...record, variants, showStock: true },
      ]);
      const page = await ProductPage(props);
      const product = page.props.children.props.product as PublicProduct;
      const api = await detailApi(
        new Request("http://localhost/api/products/synthetic-board"),
        props,
      );
      expect((await api.json()).product).toEqual(product);
      const list = await listApi(new Request("http://localhost/api/products"));
      expect((await list.json()).products[0]).toMatchObject({
        stock: product.stock,
        isInStock: inStock,
        hasVariants: named,
      });
      expect(product.isInStock).toBe(inStock);
      expect(product.hasVariants).toBe(named);
    },
  );

  it.each(["x", "../private", "board<script>", "a".repeat(101), "UPPERCASE"])(
    "rejects invalid slug %s before SQL (API 400/page 404)",
    async (slug) => {
      expect(await readPublicProduct(slug)).toBeNull();
      await expect(
        ProductPage({ params: Promise.resolve({ slug }) }),
      ).rejects.toThrow(";404");
      const response = await detailApi(
        new Request("http://localhost/api/products/invalid"),
        { params: Promise.resolve({ slug }) },
      );
      expect(response.status).toBe(400);
      expect(mocks.findFirst).not.toHaveBeenCalled();
    },
  );

  it("keeps missing separate from read failures", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(ProductPage(props)).rejects.toThrow(";404");
    await expect(generateMetadata(props)).rejects.toThrow(";404");
    expect(
      (
        await detailApi(
          new Request("http://localhost/api/products/missing"),
          props,
        )
      ).status,
    ).toBe(404);
    mocks.findFirst.mockRejectedValue(new Error("synthetic service outage"));
    await expect(ProductPage(props)).rejects.toThrow(
      "synthetic service outage",
    );
    await expect(generateMetadata(props)).rejects.toThrow(
      "synthetic service outage",
    );
    expect(
      (
        await detailApi(
          new Request("http://localhost/api/products/outage"),
          props,
        )
      ).status,
    ).toBe(500);
  });

  it("generates truthful distinct sharing metadata, canonical and readable kit snippets", async () => {
    mocks.findFirst.mockResolvedValue({
      ...record,
      name: 'Board "دارة" <script>',
      description: "Project kit.\n[kit-contents]\n٢ | موصل\n[/kit-contents]",
      images: [
        "javascript:alert(1)",
        "invalid",
        "https://example.invalid/real.png",
      ],
    });
    const meta = await generateMetadata(props);
    expect(meta.title).toBe('Board "دارة" <script> | DaraKit');
    expect(meta.description).toBe("Project kit. موصل × 2");
    expect(meta.alternates?.canonical).toBe(
      "https://darakit.com/products/synthetic-board",
    );
    expect(meta.openGraph?.images).toEqual([
      { url: "https://example.invalid/real.png", alt: 'Board "دارة" <script>' },
    ]);
    mocks.findFirst.mockResolvedValue({
      ...record,
      slug: "another-board",
      name: "Another board",
      description: null,
      images: [],
    });
    const other = await generateMetadata({
      params: Promise.resolve({ slug: "another-board" }),
    });
    expect(other.title).toBe("Another board | DaraKit");
    expect(other.description).toBeNull();
    expect(other.openGraph?.images).toEqual([]);
  });
});

describe("shared description interpretation", () => {
  it.each([
    null,
    "",
    "Plain prose",
    "[kit-contents]\n0 | bad\n[/kit-contents]",
    "[kit-contents]\n1 | incomplete",
  ])("keeps malformed/plain description truthful: %s", (description) => {
    expect(parseProductDescription(description)).toEqual({
      description: description ?? "",
      items: [],
    });
    expect(productDescriptionSnippet(description)).toBe(
      description?.trim() ? description.replace(/\s+/g, " ").trim() : null,
    );
  });
  it("handles kit-only text and truncates by Unicode characters", () => {
    expect(
      productDescriptionSnippet("[kit-contents]\n۲ | موصل\n[/kit-contents]"),
    ).toBe("موصل × 2");
    expect(
      Array.from(productDescriptionSnippet("🔧".repeat(180)) ?? ""),
    ).toHaveLength(160);
  });
});
