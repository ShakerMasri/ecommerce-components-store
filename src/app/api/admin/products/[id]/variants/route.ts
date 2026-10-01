import {
  lockOptionProduct,
  prepareOptionMutation,
  OptionMutationError,
} from "~/server/sellable-option-mutation";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "~/lib/admin";
import { validateSameOriginRequest } from "~/lib/csrf";
import { getReferenceMessage, logError } from "~/lib/logger";
import { prisma } from "~/lib/prisma";
import { rateLimit } from "~/lib/rate-limit";
import {
  createProductVariantSchema,
  productVariantParamsSchema,
} from "~/server/validations/product-variant";

type ProductVariantsRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

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

type AdminProductVariant = Prisma.ProductVariantGetPayload<{
  select: typeof adminProductVariantSelect;
}>;

function serializeProductVariant(variant: AdminProductVariant) {
  return {
    ...variant,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

function getUniqueVariantError(): Record<string, string[]> {
  return {
    _form: ["This product already has this option key."],
  };
}

export async function GET(
  _request: Request,
  { params }: ProductVariantsRouteProps,
) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const parsedParams = productVariantParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId: parsedParams.data.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminProductVariantSelect,
    });

    return NextResponse.json({
      variants: variants.map(serializeProductVariant),
    });
  } catch (error) {
    if (error instanceof OptionMutationError)
      return NextResponse.json(
        { message: error.message, errors: { _form: [error.message] } },
        { status: error.message === "Not found." ? 404 : 400 },
      );
    const errorId = logError("Failed to load product variants.", error, {
      action: "admin.productVariants.list",
      route: "/api/admin/products/[id]/variants",
      adminUserId: admin.user.id,
      productId: parsedParams.data.id,
    });

    return NextResponse.json(
      { message: getReferenceMessage("Failed to load variants.", errorId) },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: ProductVariantsRouteProps,
) {
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
  const parsedParams = productVariantParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = createProductVariantSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        message: "Invalid input.",
        errors: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const variant = await prisma.$transaction(async (tx) => {
      await lockOptionProduct(tx, parsedParams.data.id);
      const data = await prepareOptionMutation(
        tx,
        parsedParams.data.id,
        parsedBody.data,
      );
      return tx.productVariant.create({
        data: { ...data, productId: parsedParams.data.id },
        select: adminProductVariantSelect,
      });
    });

    return NextResponse.json(
      {
        message: "Variant created successfully.",
        variant: serializeProductVariant(variant),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OptionMutationError)
      return NextResponse.json(
        { message: error.message, errors: { _form: [error.message] } },
        { status: error.message === "Not found." ? 404 : 400 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message: "Invalid input.",
          errors: getUniqueVariantError(),
        },
        { status: 400 },
      );
    }

    const errorId = logError("Failed to create product variant.", error, {
      action: "admin.productVariants.create",
      route: "/api/admin/products/[id]/variants",
      adminUserId: admin.user.id,
      productId: parsedParams.data.id,
    });

    return NextResponse.json(
      { message: getReferenceMessage("Failed to create variant.", errorId) },
      { status: 500 },
    );
  }
}
