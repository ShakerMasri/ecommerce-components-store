import { z } from "zod";
import { phoneSchema } from "./phone";

const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .max(100, "Slug must be less than 100 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must use lowercase letters, numbers, and hyphens only",
  );

const priceSchema = z
  .union([z.string().trim(), z.number()])
  .refine((value) => String(value).length > 0, "Price is required")
  .refine(
    (value) => /^\d+(\.\d{1,2})?$/.test(String(value)),
    "Price must be a valid amount with up to 2 decimal places",
  )
  .transform((value) => Number(value))
  .refine((value) => value > 0, "Price must be greater than 0")
  .refine((value) => value <= 99_999_999.99, "Price is too large");

const stockSchema = z.coerce
  .number()
  .int("Stock must be a whole number")
  .min(0, "Stock cannot be negative")
  .max(100_000, "Stock is too large");

const discountPriceSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim().length === 0) {
      return null;
    }

    return value;
  },
  z.union([priceSchema, z.null()]).optional(),
);

type ProductPriceFields = {
  price?: number;
  discountPrice?: number | null;
};

function validateDiscountPrice(data: ProductPriceFields, ctx: z.RefinementCtx) {
  if (data.discountPrice == null || data.price === undefined) {
    return;
  }

  if (data.discountPrice >= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountPrice"],
      message: "Discount price must be lower than the regular price",
    });
  }
}

function isCloudinaryImageUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/image/upload/")
    );
  } catch {
    return false;
  }
}

const productImageUrlSchema = z
  .string()
  .url("Image must be a valid URL")
  .refine(
    isCloudinaryImageUrl,
    "Image must be an uploaded Cloudinary image URL",
  );

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),

  email: z.string().trim().email("Invalid email address").toLowerCase(),

  phone: phoneSchema,

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").toLowerCase(),

  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),

  phone: phoneSchema,
});

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(50, "Category name must be less than 50 characters"),

  slug: slugSchema,
});

const productFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(100, "Product name must be less than 100 characters"),

  slug: slugSchema,

  description: z
    .string()
    .trim()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .nullable(),

  price: priceSchema,

  discountPrice: discountPriceSchema,

  stock: stockSchema,

  images: z
    .array(productImageUrlSchema)
    .max(8, "You can upload up to 8 images")
    .default([]),

  isArchived: z.boolean().default(false),

  isFeatured: z.boolean().default(false),

  showStock: z.boolean().default(false),

  categoryId: z.string().min(1, "Category is required"),
});

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(100, "Name is too long."),

  slug: slugSchema,
});

export const createProductSchema = productFieldsSchema.superRefine(
  validateDiscountPrice,
);

export const updateProductSchema = productFieldsSchema
  .omit({
    isArchived: true,
    stock: true,
  })
  .partial()
  .superRefine(validateDiscountPrice);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
