import { describe, expect, it } from "vitest";
import { storeConfig } from "~/config/store";
import {
  getPublicLegalBusinessProfile,
  isPublishableLegalBusinessValue,
  isPublishablePalestinianDomain,
  legalBusinessConfig,
  type PublicLegalBusinessConfig,
} from "~/config/legal-business";

const completeConfig: PublicLegalBusinessConfig = {
  identity: {
    registeredStoreName: {
      en: "Fixture Clothing Store",
      ar: "متجر ملابس للبيانات الاختبارية",
    },
    providerLegalName: {
      en: "Fixture Trading Entity",
      ar: "منشأة تجارية للبيانات الاختبارية",
    },
    physicalAddress: {
      en: "Nablus, Palestine",
      ar: "نابلس، فلسطين",
    },
  },
  registrations: {
    commercialNumber: "CR-FIXTURE-12345",
    ecommerceNumber: "EC-FIXTURE-67890",
  },
  canonicalDomain: "https://fixture-store.ps",
  taxDisclosure: {
    en: "Prices follow the client-approved tax treatment.",
    ar: "تُعرض الأسعار وفق المعالجة الضريبية المعتمدة من العميل.",
  },
  labels: legalBusinessConfig.labels,
};

describe("legal business public configuration", () => {
  it("does not expose the intentionally incomplete template identity", () => {
    expect(getPublicLegalBusinessProfile("en")).toBeNull();
    expect(getPublicLegalBusinessProfile("ar")).toBeNull();
  });

  it("rejects obvious placeholders and non-Palestinian domains", () => {
    expect(isPublishableLegalBusinessValue("Example Store")).toBe(false);
    expect(isPublishableLegalBusinessValue("000000")).toBe(false);
    expect(isPublishableLegalBusinessValue("ضع الرقم هنا")).toBe(false);
    expect(isPublishablePalestinianDomain("https://example.com")).toBe(false);
    expect(isPublishablePalestinianDomain("https://fixture-store.ps")).toBe(
      true,
    );
  });

  it("builds the public profile only from complete publishable values", () => {
    const profile = getPublicLegalBusinessProfile("ar", completeConfig);

    expect(profile?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "commercialNumber",
          value: "CR-FIXTURE-12345",
        }),
        expect.objectContaining({
          key: "ecommerceNumber",
          value: "EC-FIXTURE-67890",
        }),
        expect.objectContaining({
          key: "canonicalDomain",
          value: "https://fixture-store.ps",
        }),
      ]),
    );
  });

  it("retains darakit.com for the storefront without bypassing the .ps profile guard", () => {
    expect(storeConfig.url).toBe("https://darakit.com");
    expect(isPublishablePalestinianDomain(storeConfig.url)).toBe(false);
    for (const locale of ["en", "ar"] as const) {
      expect(
        getPublicLegalBusinessProfile(locale, {
          ...completeConfig,
          canonicalDomain: storeConfig.url,
        }),
      ).toBeNull();
    }
  });
});
