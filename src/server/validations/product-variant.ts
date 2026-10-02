import { z } from "zod";
import { normalizeOptionKey } from "~/lib/sellable-options";

const nullableTrimmedString = (max: number, label: string) =>
  z
    .preprocess(
      (value) => {
        if (value === undefined || value === null) {
          return null;
        }

        if (typeof value !== "string") {
          return value;
        }

        const trimmed = value.trim();

        return trimmed.length > 0 ? trimmed : null;
      },
      z.string().max(max, `${label} is too long.`).nullable(),
    )
    .default(null);

const optionalBoolean = z
  .preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value;
  }, z.boolean().optional())
  .default(true);

const nonNegativeInteger = (label: string, max = 1_000_000) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() !== "") {
        return Number(value);
      }

      return value;
    },
    z
      .number({ invalid_type_error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .max(max, `${label} is too high.`),
  );

const sortOrderSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return 0;
    }

    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  }, z.number().int().min(0).max(10_000))
  .default(0);

const variantInputBaseSchema = z
  .object({
    optionLabel: nullableTrimmedString(160, "Option label"),
    isDefault: z.boolean().default(false),
    stock: nonNegativeInteger("Stock"),
    isActive: optionalBoolean,
    sortOrder: sortOrderSchema,
    deactivateOptionIds: z
      .array(z.string().cuid("Invalid option ID."))
      .max(1000)
      .default([]),
  })
  .strict();

export const createProductVariantSchema = variantInputBaseSchema.superRefine(
  (value, context) => {
    if (value.optionLabel && normalizeOptionKey(value.optionLabel).length > 200)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionLabel"],
        message: "Normalized option label is too long.",
      });
    if (value.isDefault ? Boolean(value.optionLabel) : !value.optionLabel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionLabel"],
        message: value.isDefault
          ? "Default options have no label."
          : "Enter an option label.",
      });
    }
  },
);

export const updateProductVariantSchema = variantInputBaseSchema
  .partial()
  .superRefine((value, context) => {
    if (value.optionLabel && normalizeOptionKey(value.optionLabel).length > 200)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionLabel"],
        message: "Normalized option label is too long.",
      });
    if (!Object.keys(value).length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["_form"],
        message: "At least one option field is required.",
      });
  });

export const productVariantParamsSchema = z.object({
  id: z.string().cuid("Invalid product ID."),
  variantId: z.string().cuid("Invalid variant ID.").optional(),
});
