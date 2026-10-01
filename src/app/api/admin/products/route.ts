import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "~/lib/admin";
import { getReferenceMessage, logError } from "~/lib/logger";
import { prisma } from "~/lib/prisma";
import { createProductSchema } from "~/lib/validations";
import { rateLimit } from "~/lib/rate-limit";
import { validateSameOriginRequest } from "~/lib/csrf";
import { adminProductsQuerySchema } from "~/server/validations/product";
import { getAdminInventoryPage } from "~/server/admin-product-inventory";

const adminProductVariantSelect = {
  id: true,
  productId: true,
  sizeLabel: true,
  colorLabel: true,
  sizeKey: true,
  colorKey: true,
  stock: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductVariantSelect;

function serializeProductVariant(
  variant: Prisma.ProductVariantGetPayload<{
    select: typeof adminProductVariantSelect;
  }>,
) {
  return {
    ...variant,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

const adminProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  discountPrice: true,
  stock: true,
  images: true,
  isArchived: true,
  isFeatured: true,
  showStock: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  variants: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminProductVariantSelect,
  },
} satisfies Prisma.ProductSelect;

type AdminProduct = Prisma.ProductGetPayload<{
  select: typeof adminProductSelect;
}>;

function serializeProduct(product: AdminProduct) {
  return {
    ...product,
    price: product.price.toString(),
    discountPrice: product.discountPrice?.toString() ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map(serializeProductVariant),
  };
}

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return admin.response;
  }

  const url = new URL(request.url);
  const parsedQuery = adminProductsQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        message: "Invalid filters.",
        errors: parsedQuery.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const filters = parsedQuery.data;

  try {
    const { total, products, activeProducts, archivedProducts } =
      await prisma.$transaction(
        async (tx) => {
          const { total, ids } = await getAdminInventoryPage(tx, filters);
          const hydrated = ids.length
            ? await tx.product.findMany({
                where: { id: { in: ids } },
                select: adminProductSelect,
              })
            : [];
          const byId = new Map(
            hydrated.map((product) => [product.id, product]),
          );
          // An IN query has no ordering guarantee. Use the aggregate page's order.
          const products = ids.map((id) => byId.get(id)!);
          const activeProducts = await tx.product.count({
            where: { isArchived: false },
          });
          const archivedProducts = await tx.product.count({
            where: { isArchived: true },
          });
          return { total, products, activeProducts, archivedProducts };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );

    const totalPages = Math.max(1, Math.ceil(total / filters.limit));

    return NextResponse.json({
      products: products.map(serializeProduct),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
      summary: {
        activeProducts,
        archivedProducts,
      },
    });
  } catch (error) {
    const errorId = logError("Failed to load admin products.", error, {
      action: "admin.products.list",
      route: "/api/admin/products",
      adminUserId: admin.user.id,
    });

    return NextResponse.json(
      { message: getReferenceMessage("Failed to load products.", errorId) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return admin.response;
  }
  const csrfResponse = validateSameOriginRequest(request);

  if (csrfResponse) {
    return csrfResponse;
  }
  const limited = await rateLimit(request, "adminMutation", admin.user.id);

  if (!limited.ok) {
    return limited.response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid input.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const category = await prisma.category.findUnique({
      where: {
        id: parsed.data.categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        {
          message: "Invalid input.",
          errors: {
            categoryId: ["Category not found."],
          },
        },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: parsed.data,
      select: adminProductSelect,
    });

    return NextResponse.json(
      {
        message: "Product created successfully.",
        product: serializeProduct(product),
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message: "Invalid input.",
          errors: {
            slug: ["This slug is already used."],
          },
        },
        { status: 400 },
      );
    }

    const errorId = logError("Failed to create admin product.", error, {
      action: "admin.products.create",
      route: "/api/admin/products",
      adminUserId: admin.user.id,
    });

    return NextResponse.json(
      { message: getReferenceMessage("Failed to create product.", errorId) },
      { status: 500 },
    );
  }
}
