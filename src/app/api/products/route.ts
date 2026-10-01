import { isMappedOption } from "~/lib/sellable-options";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { rateLimit } from "~/lib/rate-limit";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;
const MAX_PAGE = 10_000;
const MAX_SEARCH_LENGTH = 80;
const MAX_CATEGORY_LENGTH = 80;
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ProductListQuery = {
  category?: string;
  search?: string;
  page: number;
  pageSize: number;
};

function parsePositiveInteger(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function normalizeOptionalText(value: string | null) {
  const normalized = value?.trim().replace(/\s+/g, " ");

  return normalized ?? undefined;
}

function parseProductListQuery(searchParams: URLSearchParams) {
  const category = normalizeOptionalText(searchParams.get("category"));
  const search = normalizeOptionalText(searchParams.get("search"));
  const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
  const requestedPageSize = parsePositiveInteger(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
  );

  if (page === null || requestedPageSize === null || page > MAX_PAGE) {
    return null;
  }

  if (
    category &&
    (category.length > MAX_CATEGORY_LENGTH ||
      !CATEGORY_SLUG_PATTERN.test(category))
  ) {
    return null;
  }

  if (search && search.length > MAX_SEARCH_LENGTH) {
    return null;
  }

  return {
    category,
    search,
    page,
    pageSize: Math.min(requestedPageSize, MAX_PAGE_SIZE),
  } satisfies ProductListQuery;
}

export async function GET(request: Request) {
  const limited = await rateLimit(request, "publicRead");

  if (!limited.ok) {
    return limited.response;
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseProductListQuery(searchParams);

  if (!parsed) {
    return NextResponse.json(
      { message: "Invalid query parameters." },
      { status: 400 },
    );
  }

  const { category, search, page, pageSize } = parsed;
  const skip = (page - 1) * pageSize;

  try {
    const productWhere = {
      isArchived: false,
      ...(category
        ? {
            category: {
              slug: category,
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                category: {
                  name: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: productWhere,
        skip,
        take: pageSize + 1,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          discountPrice: true,
          images: true,
          isFeatured: true,
          showStock: true,
          _count: {
            select: {
              variants: true,
            },
          },
          variants: {
            where: {
              isActive: true,
            },
            select: {
              optionKey: true,
              optionLabel: true,
              stock: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),

      prisma.category.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),
    ]);

    const pageProducts = products.slice(0, pageSize);
    const hasMore = products.length > pageSize;

    const safeProducts = pageProducts.map((product) => {
      const activeVariantStock = product.variants
        .filter(isMappedOption)
        .reduce((sum, variant) => sum + variant.stock, 0);
      const hasVariants = product.variants.some(
        (v) => isMappedOption(v) && v.optionKey !== "default",
      );

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        stock: product.showStock ? activeVariantStock : null,
        isInStock: activeVariantStock > 0,
        images: product.images,
        isFeatured: product.isFeatured,
        showStock: product.showStock,
        category: product.category,
        hasVariants,
        price: product.price.toString(),
        discountPrice: product.discountPrice?.toString() ?? null,
      };
    });

    return NextResponse.json({
      products: safeProducts,
      categories,
      pagination: {
        page,
        pageSize,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to load products." },
      { status: 500 },
    );
  }
}
