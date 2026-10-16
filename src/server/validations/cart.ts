import { z } from "zod";
import { MAX_CART_ITEM_QUANTITY } from "~/lib/cart";

export const addCartItemSchema = z.object({
  productId: z.string().cuid("Invalid product ID."),
  productVariantId: z.string().cuid("Invalid product variant ID."),
  quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
});

export const cartItemParamsSchema = z.object({
  id: z.string().cuid("Invalid cart item ID."),
});
