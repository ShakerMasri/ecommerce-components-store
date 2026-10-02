import { isMappedOption } from "~/lib/sellable-options";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { validateSameOriginRequest } from "~/lib/csrf";
import { prisma } from "~/lib/prisma";
import { rateLimit } from "~/lib/rate-limit";
import { auth } from "~/server/auth";
import {
  cartItemParamsSchema,
  updateCartItemSchema,
} from "~/server/validations/cart";

type CartItemRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const cartItemSelect = {
  id: true,
  productId: true,
  productVariantId: true,
  cartLineKey: true,
  quantity: true,
} satisfies Prisma.CartItemSelect;

function cartItemErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "CART_ITEM_NOT_FOUND") {
    return NextResponse.json(
      { message: "Cart item not found." },
      { status: 404 },
    );
  }

  if (error instanceof Error && error.message === "PRODUCT_NOT_AVAILABLE") {
    return NextResponse.json(
      { message: "This product is no longer available." },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === "VARIANT_REQUIRED") {
    return NextResponse.json(
      { message: "Please remove this item and choose a option again." },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === "VARIANT_NOT_AVAILABLE") {
    return NextResponse.json(
      { message: "The selected option is no longer available." },
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

export async function PATCH(request: Request, { params }: CartItemRouteProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "You must be logged in to update your cart." },
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

  const { id } = await params;

  const parsedParams = cartItemParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json(
      { message: "Invalid cart item ID." },
      { status: 400 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = updateCartItemSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid quantity." }, { status: 400 });
  }

  const { quantity } = parsedBody.data;

  try {
    const updatedCartItem = await prisma.$transaction(async (tx) => {
      const existingCartItem = await tx.cartItem.findFirst({
        where: {
          id: parsedParams.data.id,
          userId,
        },
        select: {
          id: true,
          productVariantId: true,
          product: {
            select: {
              id: true,
              isArchived: true,
            },
          },
          productVariant: {
            select: {
              id: true,
              productId: true,
              stock: true,
              isActive: true,
              optionKey: true,
              optionLabel: true,
            },
          },
        },
      });

      if (!existingCartItem) {
        throw new Error("CART_ITEM_NOT_FOUND");
      }

      if (existingCartItem.product.isArchived) {
        throw new Error("PRODUCT_NOT_AVAILABLE");
      }

      if (!existingCartItem.productVariantId) {
        throw new Error("VARIANT_REQUIRED");
      }

      if (
        !existingCartItem.productVariant?.isActive ||
        !isMappedOption(existingCartItem.productVariant) ||
        existingCartItem.productVariant.productId !==
          existingCartItem.product.id
      ) {
        throw new Error("VARIANT_NOT_AVAILABLE");
      }

      const availableStock = existingCartItem.productVariant.stock;

      if (quantity > availableStock) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      const updateResult = await tx.cartItem.updateMany({
        where: {
          id: existingCartItem.id,
          userId,
        },
        data: {
          quantity,
        },
      });

      if (updateResult.count !== 1) {
        throw new Error("CART_ITEM_NOT_FOUND");
      }

      const cartItem = await tx.cartItem.findFirst({
        where: {
          id: existingCartItem.id,
          userId,
        },
        select: cartItemSelect,
      });

      if (!cartItem) {
        throw new Error("CART_ITEM_NOT_FOUND");
      }

      return cartItem;
    });

    return NextResponse.json({
      message: "Cart item updated.",
      cartItem: updatedCartItem,
    });
  } catch (error) {
    const response = cartItemErrorResponse(error);

    if (response) {
      return response;
    }

    return NextResponse.json(
      { message: "Failed to update cart item." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: CartItemRouteProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "You must be logged in to remove cart items." },
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

  const { id } = await params;

  const parsedParams = cartItemParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json(
      { message: "Invalid cart item ID." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.cartItem.deleteMany({
      where: {
        id: parsedParams.data.id,
        userId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { message: "Cart item not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Cart item removed.",
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to remove cart item." },
      { status: 500 },
    );
  }
}
