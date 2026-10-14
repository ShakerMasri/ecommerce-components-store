import "server-only";

import { type Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "~/lib/prisma";
import {
  type PublicProduct,
  type PublicProductSummary,
} from "~/lib/public-product";
import { isMappedOption } from "~/lib/sellable-options";
import { productSlugSchema } from "~/server/validations/product";

export const publicProductListSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  discountPrice: true,
  images: true,
  isFeatured: true,
  showStock: true,
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    where: { isActive: true },
    select: { optionKey: true, optionLabel: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

const publicProductDetailSelect = {
  ...publicProductListSelect,
  description: true,
  createdAt: true,
  variants: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      optionKey: true,
      optionLabel: true,
      sizeLabel: true,
      colorLabel: true,
      stock: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.ProductSelect;

type ListRecord = Prisma.ProductGetPayload<{
  select: typeof publicProductListSelect;
}>;
type DetailRecord = Prisma.ProductGetPayload<{
  select: typeof publicProductDetailSelect;
}>;

export function mapPublicProductSummary(
  product: ListRecord,
): PublicProductSummary {
  const mapped = product.variants.filter(isMappedOption);
  const stock = mapped.reduce((sum, variant) => sum + variant.stock, 0);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price.toString(),
    discountPrice: product.discountPrice?.toString() ?? null,
    images: product.images,
    isFeatured: product.isFeatured,
    showStock: product.showStock,
    category: product.category,
    stock: product.showStock ? stock : null,
    isInStock: stock > 0,
    hasVariants: mapped.some((variant) => variant.optionKey !== "default"),
  };
}

function mapPublicProduct(product: DetailRecord): PublicProduct {
  return {
    ...mapPublicProductSummary(product),
    description: product.description,
    createdAt: product.createdAt.toISOString(),
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
  };
}

// Request protection belongs to API/middleware boundaries, never this reader.
// Invalid/missing/archived => null; service failures propagate as failures.
export async function readPublicProduct(
  slug: string,
): Promise<PublicProduct | null> {
  const parsed = productSlugSchema.safeParse({ slug });
  if (!parsed.success) return null;
  const product = await prisma.product.findFirst({
    where: { slug: parsed.data.slug, isArchived: false },
    select: publicProductDetailSelect,
  });
  return product ? mapPublicProduct(product) : null;
}

// React owns this memoization for one render request; no persistent catalog cache.
export const getPublicProduct = cache(readPublicProduct);
