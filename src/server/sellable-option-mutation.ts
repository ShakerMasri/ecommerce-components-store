import { Prisma } from "@prisma/client";
import {
  DEFAULT_OPTION_KEY,
  isMappedOption,
  normalizeOptionKey,
} from "~/lib/sellable-options";

export class OptionMutationError extends Error {}

export async function lockOptionProduct(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  // Serialize option writers while allowing checkout's product FK key-share lock.
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR NO KEY UPDATE`);
  if (!rows.length) throw new OptionMutationError("Not found.");
}

type Input = {
  optionLabel?: string | null;
  isDefault?: boolean;
  stock?: number;
  isActive?: boolean;
  sortOrder?: number;
  deactivateOptionIds?: string[];
};

// Caller must hold the product lock for the entire transaction, including the
// target write. Explicit sibling deactivation rolls back if that write fails.
export async function prepareOptionMutation(
  tx: Prisma.TransactionClient,
  productId: string,
  input: Input,
  variantId?: string,
) {
  const existing = variantId
    ? await tx.productVariant.findUnique({ where: { id: variantId } })
    : null;
  if (variantId && existing?.productId !== productId)
    throw new OptionMutationError("Not found.");
  const isDefault =
    input.isDefault ?? existing?.optionKey === DEFAULT_OPTION_KEY;
  if (
    existing?.optionKey &&
    isDefault !== (existing.optionKey === DEFAULT_OPTION_KEY)
  ) {
    throw new OptionMutationError(
      "Deactivate this option and create or reactivate the other option type. Existing cart selections must keep their identity.",
    );
  }
  if (existing && !existing.optionKey && isDefault) {
    throw new OptionMutationError(
      "Unmapped legacy options cannot be converted into defaults.",
    );
  }
  const optionLabel = isDefault
    ? null
    : input.optionLabel !== undefined
      ? input.optionLabel
      : (existing?.optionLabel ?? null);
  if (isDefault && input.optionLabel)
    throw new OptionMutationError("Default options have no label.");
  const optionKey = isDefault
    ? DEFAULT_OPTION_KEY
    : optionLabel
      ? normalizeOptionKey(optionLabel)
      : null;
  const isActive = input.isActive ?? existing?.isActive ?? true;
  if (!isMappedOption({ optionKey, optionLabel }))
    throw new OptionMutationError(
      "Enter an option label before saving this option.",
    );
  const siblings = await tx.productVariant.findMany({
    where: { productId, ...(variantId ? { id: { not: variantId } } : {}) },
    select: { id: true, optionKey: true, isActive: true },
  });
  const deactivateIds = [...new Set(input.deactivateOptionIds ?? [])];
  if (deactivateIds.some((id) => !siblings.some((v) => v.id === id)))
    throw new OptionMutationError(
      "A transition option is missing or belongs to another product. Reload the product before trying again.",
    );
  if (siblings.some((v) => v.optionKey === optionKey))
    throw new OptionMutationError("This product already has this option key.");
  if (
    isActive &&
    siblings.some(
      (v) =>
        v.isActive &&
        !deactivateIds.includes(v.id) &&
        (isDefault || v.optionKey === DEFAULT_OPTION_KEY),
    )
  ) {
    throw new OptionMutationError(
      "Deactivate the existing default or named options before activating the other type. Stock is not transferred.",
    );
  }
  if (deactivateIds.length)
    await tx.productVariant.updateMany({
      where: { productId, id: { in: deactivateIds } },
      data: { isActive: false },
    });
  return {
    optionLabel,
    optionKey,
    ...(input.stock === undefined ? {} : { stock: input.stock }),
    isActive,
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
  };
}
