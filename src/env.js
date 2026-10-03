import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * @param {string} value
 */
const isLocalUrl = (value) => {
  try {
    const url = new URL(value);

    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
};

const appUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      if (isLocalUrl(value)) {
        return true;
      }

      return value.startsWith("https://");
    },
    {
      message: "Public app URLs must use https:// unless they are localhost.",
    },
  );

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(32)
        : z.string().min(32).optional(),

    BETTER_AUTH_URL: appUrlSchema,
    APP_URL: appUrlSchema,

    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: z.coerce.number().int().positive().max(65535),
    SMTP_USER: z.string().trim().min(1),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_FROM_EMAIL: z.string().email(),
    SMTP_FROM_NAME: z.string().trim().min(1),

    ORDER_RECEIPT_FROM_EMAIL: z.string().email().optional(),

    ORDER_NOTIFICATION_EMAIL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().email().optional(),
    ),

    EMAIL_DELIVERY_MODE: z
      .enum(["smtp", "log"])
      .default("smtp")
      .refine(
        (mode) => process.env.NODE_ENV !== "production" || mode === "smtp",
        { message: "Production email delivery requires SMTP." },
      ),

    UPSTASH_REDIS_REST_URL:
      process.env.NODE_ENV === "production"
        ? z.string().url()
        : z.string().url().optional(),

    UPSTASH_REDIS_REST_TOKEN:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),

    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CLOUDINARY_PRODUCT_FOLDER: z
      .string()
      .min(1)
      .default("ecommerce-template-clothing/products"),
  },

  client: {},

  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    APP_URL: process.env.APP_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,

    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
    ORDER_RECEIPT_FROM_EMAIL: process.env.ORDER_RECEIPT_FROM_EMAIL,
    ORDER_NOTIFICATION_EMAIL: process.env.ORDER_NOTIFICATION_EMAIL,

    EMAIL_DELIVERY_MODE: process.env.EMAIL_DELIVERY_MODE,

    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_PRODUCT_FOLDER: process.env.CLOUDINARY_PRODUCT_FOLDER,
  },

  skipValidation:
    process.env.NODE_ENV !== "production" && !!process.env.SKIP_ENV_VALIDATION,

  emptyStringAsUndefined: true,
});
