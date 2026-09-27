import { z } from "zod";
import { updateProfileSchema } from "~/lib/validations";
import { getDeliveryAreaByKey, isDeliveryAreaKey } from "~/lib/delivery";

export const createOrderSchema = z
  .object({
    phone: updateProfileSchema.shape.phone,

    idempotencyKey: z.string().uuid("Invalid idempotency key."),

    deliveryAreaKey: z
      .string({ required_error: "Delivery area is required." })
      .refine(isDeliveryAreaKey, "Please select a valid delivery area."),

    deliveryCity: z
      .string({ required_error: "City or area is required." })
      .trim()
      .min(2, "City or area must be at least 2 characters.")
      .max(100, "City or area must be less than 100 characters."),

    deliveryAddress: z
      .string()
      .trim()
      .max(300, "Delivery address must be less than 300 characters.")
      .optional()
      .default(""),

    deliveryNotes: z
      .string()
      .trim()
      .max(500, "Delivery notes must be less than 500 characters.")
      .optional()
      .default(""),

    pickupAgreementAccepted: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((data, ctx) => {
    const deliveryArea = getDeliveryAreaByKey(data.deliveryAreaKey);

    if (!deliveryArea) {
      return;
    }

    if (deliveryArea.requiresCustomerAgreement) {
      if (!data.pickupAgreementAccepted) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Please agree or coordinate with the store owner on WhatsApp before choosing the Nablus receive point.",
          path: ["pickupAgreementAccepted"],
        });
      }

      return;
    }

    if (data.deliveryAddress.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery address must be at least 5 characters.",
        path: ["deliveryAddress"],
      });
    }
  });

export const customerOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(20).optional().default(20),
  })
  .strict();
