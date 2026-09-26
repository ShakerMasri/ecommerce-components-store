import { contactConfig } from "~/config/contact";

/**
 * Public, client-safe store configuration.
 *
 * This file is safe to import from Server Components, Client Components, and tests.
 * Do not put secrets, tokens, credentials, private URLs, or internal service keys here.
 * Sensitive deployment settings must stay in environment variables validated by src/env.js.
 */
export const storeConfig = {
  name: "Components Store",
  shortName: "Components Store",
  description:
    "Electronic components for circuits, prototypes and university projects.",
  metadata: {
    title: "Components Store",
    description:
      "Browse electronic components, review product details and check available options.",
  },
  contact: contactConfig,
  locales: {
    en: {
      name: "Components Store",
      logoStart: "Components",
      logoAccent: "Store",
    },
    ar: {
      name: "متجر المكوّنات",
      logoStart: "متجر",
      logoAccent: "المكوّنات",
    },
  },
} as const;

export type StoreConfig = typeof storeConfig;
