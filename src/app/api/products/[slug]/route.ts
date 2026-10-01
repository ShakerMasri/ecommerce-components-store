import { isMappedOption } from "~/lib/sellable-options";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { rateLimit } from "~/lib/rate-limit";
import { productSlugSchema } from "~/server/validations/product";

type ProductRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, { params }: ProductRouteProps) {
  const limited = await rateLimit(request, "publicRead");

  if (!limited.ok) {
    return limited.response;
  }

  const { slug } = await params;

  const parsed = productSlugSchema.safeParse({ slug });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid product slug." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        slug: parsed.data.slug,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        discountPrice: true,
        images: true,
        isFeatured: true,
        showStock: true,
        createdAt: true,
        _count: {
          select: {
            variants: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        variants: {
          where: {
            isActive: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            optionLabel: true,
            optionKey: true,
            sizeLabel: true,
            colorLabel: true,
            stock: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { message: "Product not found." },
        { status: 404 },
      );
    }

    const mappedVariants = product.variants.filter(isMappedOption);
    const activeVariantStock = mappedVariants.reduce(
      (sum, variant) => sum + variant.stock,
      0,
    );
    const hasVariants = product.variants.some(
      (v) => isMappedOption(v) && v.optionKey !== "default",
    );

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price.toString(),
        discountPrice: product.discountPrice?.toString() ?? null,
        stock: product.showStock ? activeVariantStock : null,
        isInStock: activeVariantStock > 0,
        images: product.images,
        isFeatured: product.isFeatured,
        showStock: product.showStock,
        createdAt: product.createdAt,
        category: product.category,
        hasVariants,
        variants: product.variants.filter(isMappedOption).map((variant) => ({
          id: variant.id,
          optionKey: variant.optionKey,
          optionLabel: variant.optionLabel,
          sizeLabel: variant.sizeLabel,
          colorLabel: variant.colorLabel,
          stock: product.showStock ? variant.stock : null,
          isInStock: variant.stock > 0,
          sortOrder: variant.sortOrder,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to load product." },
      { status: 500 },
    );
  }
}
