import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "~/lib/admin";
import { prisma } from "~/lib/prisma";
import { updateProductSchema } from "~/lib/validations";
import { rateLimit } from "~/lib/rate-limit";
import { validateSameOriginRequest } from "~/lib/csrf";

type ProductRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const productParamsSchema = z.object({
  id: z.string().min(1, "Product ID is required."),
});

const adminProductVariantSelect = {
  id: true,
  productId: true,
  optionLabel: true,
  optionKey: true,
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

export async function GET(_request: Request, { params }: ProductRouteProps) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const parsedParams = productParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: {
        id: parsedParams.data.id,
      },
      select: adminProductSelect,
    });

    if (!product) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }

    return NextResponse.json({
      product: serializeProduct(product),
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to load product." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: ProductRouteProps) {
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

  const { id } = await params;
  const parsedParams = productParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = updateProductSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        message: "Invalid input.",
        errors: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (Object.keys(parsedBody.data).length === 0) {
    return NextResponse.json(
      {
        message: "Invalid input.",
        errors: {
          _form: ["At least one product field is required."],
        },
      },
      { status: 400 },
    );
  }

  try {
    if (parsedBody.data.categoryId) {
      const category = await prisma.category.findUnique({
        where: {
          id: parsedBody.data.categoryId,
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
    }

    if (
      parsedBody.data.price !== undefined ||
      parsedBody.data.discountPrice !== undefined
    ) {
      const existingProduct = await prisma.product.findUnique({
        where: {
          id: parsedParams.data.id,
        },
        select: {
          price: true,
          discountPrice: true,
        },
      });

      if (!existingProduct) {
        return NextResponse.json({ message: "Not found." }, { status: 404 });
      }

      const nextPrice =
        parsedBody.data.price !== undefined
          ? new Prisma.Decimal(parsedBody.data.price)
          : existingProduct.price;
      const nextDiscountPrice =
        parsedBody.data.discountPrice !== undefined
          ? parsedBody.data.discountPrice === null
            ? null
            : new Prisma.Decimal(parsedBody.data.discountPrice)
          : existingProduct.discountPrice;

      if (nextDiscountPrice?.gte(nextPrice)) {
        return NextResponse.json(
          {
            message: "Invalid input.",
            errors: {
              discountPrice: [
                "Discount price must be lower than the regular price.",
              ],
            },
          },
          { status: 400 },
        );
      }
    }

    const product = await prisma.product.update({
      where: {
        id: parsedParams.data.id,
      },
      data: parsedBody.data,
      select: adminProductSelect,
    });

    return NextResponse.json({
      message: "Product updated successfully.",
      product: serializeProduct(product),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }

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

    return NextResponse.json(
      { message: "Failed to update product." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: ProductRouteProps) {
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

  const { id } = await params;
  const parsedParams = productParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  try {
    const product = await prisma.product.update({
      where: {
        id: parsedParams.data.id,
      },
      data: {
        isArchived: true,
      },
      select: adminProductSelect,
    });

    return NextResponse.json({
      message: "Product archived successfully.",
      product: serializeProduct(product),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Failed to archive product." },
      { status: 500 },
    );
  }
}
