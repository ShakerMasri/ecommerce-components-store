import { contactConfig } from "~/config/contact";

/**
 * Public, client-safe store configuration.
 *
 * This file is safe to import from Server Components, Client Components, and tests.
 * Do not put secrets, tokens, credentials, private URLs, or internal service keys here.
 * Sensitive deployment settings must stay in environment variables validated by src/env.js.
 */
export const storeConfig = {
  name: "Darakit",
  shortName: "Darakit",
  url: "https://darakit.com",
  description:
    "Darakit: electronic components for circuits, prototypes and university projects.",
  metadata: {
    title: "Darakit",
    description:
      "Browse electronic components at Darakit, review product details and check available options.",
  },
  contact: contactConfig,
  locales: {
    en: {
      name: "Darakit",
      logoStart: "Darakit",
      logoAccent: "",
    },
    ar: {
      name: "Darakit",
      logoStart: "Darakit",
      logoAccent: "",
    },
  },
} as const;

export type StoreConfig = typeof storeConfig;
