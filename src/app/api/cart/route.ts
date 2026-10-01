import { isMappedOption } from "~/lib/sellable-options";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { auth } from "~/server/auth";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "You must be logged in to view your cart." },
      { status: 401 },
    );
  }

  try {
    const customer = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        name: true,
        email: true,
        emailVerified: true,
        phone: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { message: "Your account could not be found." },
        { status: 401 },
      );
    }

    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        quantity: true,
        productVariantId: true,
        productVariant: {
          select: {
            id: true,
            productId: true,
            optionLabel: true,
            optionKey: true,
            sizeLabel: true,
            colorLabel: true,
            stock: true,
            isActive: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            discountPrice: true,
            images: true,
            isArchived: true,
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
                id: true,
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
        },
      },
    });

    const safeCartItems = cartItems.map((item) => {
      const activeVariantStock = item.product.variants
        .filter(isMappedOption)
        .reduce((sum, variant) => sum + variant.stock, 0);
      const hasVariants = item.product.variants.some(
        (v) => isMappedOption(v) && v.optionKey !== "default",
      );
      const selectedVariant =
        item.productVariant?.isActive &&
        isMappedOption(item.productVariant) &&
        item.productVariant.productId === item.product.id
          ? item.productVariant
          : null;
      const exactAvailableStock = selectedVariant?.stock ?? 0;
      const isAvailable =
        !item.product.isArchived &&
        Boolean(selectedVariant) &&
        exactAvailableStock > 0;
      const hasEnoughStock =
        isAvailable && item.quantity <= exactAvailableStock;

      return {
        id: item.id,
        quantity: item.quantity,
        productVariantId: item.productVariantId,
        productVariant: selectedVariant
          ? {
              id: selectedVariant.id,
              optionLabel: selectedVariant.optionLabel,
              optionKey: selectedVariant.optionKey,
              sizeLabel: selectedVariant.sizeLabel,
              colorLabel: selectedVariant.colorLabel,
              stock: item.product.showStock ? selectedVariant.stock : null,
              isInStock: selectedVariant.stock > 0,
              isActive: selectedVariant.isActive,
            }
          : null,
        availableStock: item.product.showStock ? exactAvailableStock : null,
        isAvailable,
        hasEnoughStock,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: item.product.price.toString(),
          discountPrice: item.product.discountPrice?.toString() ?? null,
          stock: item.product.showStock ? activeVariantStock : null,
          isInStock: activeVariantStock > 0,
          images: item.product.images,
          isArchived: item.product.isArchived,
          showStock: item.product.showStock,
          hasVariants,
          category: item.product.category,
        },
      };
    });

    return NextResponse.json({ cartItems: safeCartItems, customer });
  } catch {
    return NextResponse.json(
      { message: "Failed to load cart." },
      { status: 500 },
    );
  }
}
