import { isMappedOption } from "~/lib/sellable-options";
import { NextResponse } from "next/server";
import { validateSameOriginRequest } from "~/lib/csrf";
import { prisma } from "~/lib/prisma";
import { rateLimit } from "~/lib/rate-limit";
import { auth } from "~/server/auth";
import { lockCustomerCart } from "~/server/cart-lock";
import { addCartItemSchema } from "~/server/validations/cart";

function getCartLineKey(productId: string, productVariantId: string | null) {
  return productVariantId
    ? `variant:${productVariantId}`
    : `product:${productId}`;
}

function cartItemErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "PRODUCT_NOT_AVAILABLE") {
    return NextResponse.json(
      { message: "Product is not available." },
      { status: 404 },
    );
  }

  if (error instanceof Error && error.message === "VARIANT_REQUIRED") {
    return NextResponse.json(
      { message: "Please choose a option before adding this product." },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === "VARIANT_NOT_ALLOWED") {
    return NextResponse.json(
      { message: "This product does not use selectable variants." },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === "VARIANT_NOT_AVAILABLE") {
    return NextResponse.json(
      { message: "The selected option is not available." },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
    return NextResponse.json(
      { message: "Not enough stock available." },
      { status: 400 },
    );
  }

  return null;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "You must be logged in to add items to your cart." },
      { status: 401 },
    );
  }
  const csrfResponse = validateSameOriginRequest(request);

  if (csrfResponse) {
    return csrfResponse;
  }

  const userId = session.user.id;

  const limited = await rateLimit(request, "cartMutation", userId);

  if (!limited.ok) {
    return limited.response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = addCartItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid cart item data." },
      { status: 400 },
    );
  }

  const { productId, productVariantId, quantity } = parsed.data;

  try {
    const cartItem = await prisma.$transaction(async (tx) => {
      await lockCustomerCart(tx, userId);
      const product = await tx.product.findUnique({
        where: {
          id: productId,
        },
        select: {
          id: true,
          isArchived: true,
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
        },
      });

      if (!product || product.isArchived) {
        throw new Error("PRODUCT_NOT_AVAILABLE");
      }

      if (!productVariantId) {
        throw new Error("VARIANT_REQUIRED");
      }

      const selectedVariant = product.variants.find(
        (variant) => variant.id === productVariantId,
      );

      if (!selectedVariant || !isMappedOption(selectedVariant)) {
        throw new Error("VARIANT_NOT_AVAILABLE");
      }

      const availableStock = selectedVariant.stock;

      if (quantity > availableStock) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      const cartLineKey = getCartLineKey(
        product.id,
        selectedVariant?.id ?? null,
      );

      const existingCartItem = await tx.cartItem.findUnique({
        where: {
          userId_cartLineKey: {
            userId,
            cartLineKey,
          },
        },
      });

      if (existingCartItem) {
        const nextQuantity = existingCartItem.quantity + quantity;

        if (nextQuantity > availableStock) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        return tx.cartItem.update({
          where: {
            id: existingCartItem.id,
          },
          data: {
            quantity: nextQuantity,
          },
        });
      }

      return tx.cartItem.create({
        data: {
          userId,
          productId,
          productVariantId: selectedVariant?.id ?? null,
          cartLineKey,
          quantity,
        },
      });
    });

    return NextResponse.json({
      message: "Item added to cart.",
      cartItem,
    });
  } catch (error) {
    const response = cartItemErrorResponse(error);

    if (response) {
      return response;
    }

    return NextResponse.json(
      { message: "Failed to add item to cart." },
      { status: 500 },
    );
  }
}
