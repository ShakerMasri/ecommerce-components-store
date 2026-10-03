import { contactConfig } from "~/config/contact";

/**
 * Public, client-safe store configuration.
 *
 * This file is safe to import from Server Components, Client Components, and tests.
 * Do not put secrets, tokens, credentials, private URLs, or internal service keys here.
 * Sensitive deployment settings must stay in environment variables validated by src/env.js.
 */
export const storeConfig = {
  name: "DaraKit",
  shortName: "DaraKit",
  url: "https://darakit.com",
  description:
    "Electronic components, IoT supplies and student project kits for hardware projects.",
  metadata: {
    title: "DaraKit",
    description:
      "Electronic components, IoT supplies and student project kits for hardware projects.",
  },
  contact: contactConfig,
  locales: {
    en: {
      description:
        "Electronic components, IoT supplies and student project kits for hardware projects.",
      name: "DaraKit",
      logoStart: "DaraKit",
      logoAccent: "",
    },
    ar: {
      description:
        "مكوّنات إلكترونية ومستلزمات إنترنت الأشياء وأطقم مشاريع طلابية للمشاريع العملية في الإلكترونيات.",
      name: "دارة كيت",
      logoStart: "DaraKit",
      logoAccent: "",
    },
  },
} as const;

export type StoreConfig = typeof storeConfig;
