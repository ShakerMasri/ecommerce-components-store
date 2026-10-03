import { describe, expect, it } from "vitest";
import {
  getPublicTaxDisclosure,
  legalBusinessConfig,
  type PublicLegalBusinessConfig,
} from "~/config/legal-business";
import {
  getDeliveryMethodLabel,
  getEstimatedDeliveryDuration,
} from "~/lib/delivery";

describe("checkout compliance disclosures", () => {
  it("exposes localized delivery method and duration from typed config", () => {
    expect(getDeliveryMethodLabel("en").toLowerCase()).toContain("delivery");
    expect(getDeliveryMethodLabel("ar")).toContain("توصيل");
    expect(getEstimatedDeliveryDuration("en")).toContain("coordinate");
    expect(getEstimatedDeliveryDuration("ar")).toContain("تنسيق");
  });

  it("omits unconfigured or placeholder tax wording", () => {
    expect(getPublicTaxDisclosure("en")).toBeNull();

    const placeholderConfig: PublicLegalBusinessConfig = {
      ...legalBusinessConfig,
      taxDisclosure: { en: "Example tax text", ar: "نص تجريبي" },
    };

    expect(getPublicTaxDisclosure("en", placeholderConfig)).toBeNull();
    expect(getPublicTaxDisclosure("ar", placeholderConfig)).toBeNull();
  });

  it("returns the configured localized tax wording with language fallback", () => {
    const configuredTax: PublicLegalBusinessConfig = {
      ...legalBusinessConfig,
      taxDisclosure: {
        en: "Prices use the accountant-approved tax treatment.",
        ar: null,
      },
    };

    expect(getPublicTaxDisclosure("en", configuredTax)).toBe(
      "Prices use the accountant-approved tax treatment.",
    );
    expect(getPublicTaxDisclosure("ar", configuredTax)).toBe(
      "Prices use the accountant-approved tax treatment.",
    );
  });
});
