/**
 * Public, client-safe delivery configuration.
 *
 * This file is safe to import from Server Components, Client Components, route
 * handlers, and tests. Do not put secrets, private service URLs, credentials, or
 * deployment-only settings here.
 *
 * Keep delivery area keys stable after orders exist. Orders snapshot the selected
 * key and price at checkout, so changing labels is safe for new storefront copy,
 * but renaming/removing keys can make old order history harder to read.
 */
export type DeliveryConfigLocale = "en" | "ar";

export type DeliveryAreaLabels = {
  label: string;
  note?: string;
  agreementLabel?: string;
};

type DeliveryAreaConfig = {
  key: string;
  priceNis: number;
  requiresCustomerAgreement: boolean;
  labels: Record<DeliveryConfigLocale, DeliveryAreaLabels>;
};

type DeliveryConfigDefinition<TAreas extends readonly DeliveryAreaConfig[]> = {
  currency: {
    code: string;
    labels: Record<DeliveryConfigLocale, string>;
    freeLabels: Record<DeliveryConfigLocale, string>;
  };
  method: {
    labels: Record<DeliveryConfigLocale, string>;
  };
  estimatedDuration: {
    labels: Record<DeliveryConfigLocale, string>;
  };
  defaultAreaKey: TAreas[number]["key"];
  areas: TAreas;
};

function defineDeliveryConfig<
  const TAreas extends readonly DeliveryAreaConfig[],
>(config: DeliveryConfigDefinition<TAreas>) {
  return config;
}

// Existing prices are provisional pending owner confirmation; preserve keys and fees.
export const deliveryConfig = defineDeliveryConfig({
  currency: {
    code: "NIS",
    labels: {
      en: "NIS",
      ar: "شيكل",
    },
    freeLabels: {
      en: "Free",
      ar: "مجاني",
    },
  },
  method: {
    labels: {
      en: "Delivery arrangements are coordinated with the store",
      ar: "يتم تنسيق ترتيبات التوصيل مع المتجر",
    },
  },
  estimatedDuration: {
    labels: {
      en: "Contact us to coordinate delivery timing after order confirmation",
      ar: "تواصل معنا لتنسيق موعد التوصيل بعد تأكيد الطلب",
    },
  },
  defaultAreaKey: "west_bank_cities",
  areas: [
    {
      key: "nablus_receive_point",
      priceNis: 0,
      requiresCustomerAgreement: true,
      labels: {
        en: {
          label: "Nablus collection point by prior arrangement",
          note: "Collection at a point in Nablus by prior arrangement on WhatsApp, with no collection fee. For home delivery in Nablus, select West Bank cities.",
          agreementLabel:
            "I understand this is collection at a point in Nablus, and I must arrange it with the store on WhatsApp before collecting my order.",
        },
        ar: {
          label: "نقطة استلام في نابلس بترتيب مسبق",
          note: "استلام من نقطة في نابلس بترتيب مسبق عبر واتساب، دون رسوم استلام. للتوصيل إلى المنزل في نابلس، اختر مدن الضفة الغربية.",
          agreementLabel:
            "أفهم أن هذا استلام من نقطة في نابلس، ويجب أن أنسق مع المتجر عبر واتساب قبل استلام طلبي.",
        },
      },
    },
    {
      key: "west_bank_cities",
      priceNis: 20,
      requiresCustomerAgreement: false,
      labels: {
        en: {
          label: "West Bank cities",
        },
        ar: {
          label: "مدن الضفة الغربية",
        },
      },
    },
    {
      key: "jerusalem",
      priceNis: 30,
      requiresCustomerAgreement: false,
      labels: {
        en: {
          label: "Jerusalem",
        },
        ar: {
          label: "القدس",
        },
      },
    },
    {
      key: "lands_48",
      priceNis: 70,
      requiresCustomerAgreement: false,
      labels: {
        en: {
          label: "48 lands",
        },
        ar: {
          label: "أراضي 48",
        },
      },
    },
    {
      key: "west_jerusalem_area",
      priceNis: 45,
      requiresCustomerAgreement: false,
      labels: {
        en: {
          label: "West Jerusalem, Ein Rafa, Ein Naqouba, Abu Ghosh",
        },
        ar: {
          label: "غرب القدس، عين رافا، عين نقوبا، أبو غوش",
        },
      },
    },
  ],
});

export type DeliveryConfig = typeof deliveryConfig;
export type DeliveryAreaKey = DeliveryConfig["areas"][number]["key"];
