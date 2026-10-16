import { z } from "zod";
import { phoneSchema } from "./phone";

export const profileNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(50, "Name must be less than 50 characters");

export const profileSchema = z.object({
  name: profileNameSchema,
  phone: phoneSchema,
});

// Provider-created accounts can initially lack a phone. User-supplied phone
// fields still use phoneSchema at the auth input boundary.
export const authProfileCreateSchema = profileSchema.extend({
  phone: phoneSchema.nullish(),
});
export const authProfileUpdateSchema = profileSchema.partial();
