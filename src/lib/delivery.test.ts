import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_AREA_KEY,
  DELIVERY_AREAS,
  formatDeliveryPriceNis,
  getDefaultDeliveryArea,
  getDeliveryAreaByKey,
  getDeliveryAreaLabels,
  getDeliveryCurrencyLabel,
  getDeliveryPriceNis,
  getFreeDeliveryLabel,
  isDeliveryAreaKey,
} from "./delivery";

describe("delivery areas", () => {
  it("defines delivery prices from the typed delivery config", () => {
    expect(DELIVERY_AREAS).toHaveLength(5);
    expect(getDeliveryPriceNis("nablus_receive_point")).toBe(0);
    expect(getDeliveryPriceNis("west_bank_cities")).toBe(20);
    expect(getDeliveryPriceNis("jerusalem")).toBe(35);
    expect(getDeliveryPriceNis("lands_48")).toBe(70);
    expect(getDeliveryPriceNis("west_jerusalem_area")).toBe(50);
  });

  it("defines a safe default delivery area", () => {
    expect(DEFAULT_DELIVERY_AREA_KEY).toBe("west_bank_cities");
    expect(getDefaultDeliveryArea().key).toBe(DEFAULT_DELIVERY_AREA_KEY);
  });

  it("marks the free Nablus receive point as requiring customer agreement", () => {
    const area = getDeliveryAreaByKey("nablus_receive_point");

    expect(area).not.toBeNull();
    expect(area?.priceNis).toBe(0);
    expect(area?.requiresCustomerAgreement).toBe(true);
  });

  it("validates delivery area keys", () => {
    expect(isDeliveryAreaKey("jerusalem")).toBe(true);
    expect(isDeliveryAreaKey("unknown-area")).toBe(false);
  });

  it("returns null for unknown delivery prices", () => {
    expect(getDeliveryPriceNis("unknown-area")).toBeNull();
  });

  it("exposes localized client-safe delivery labels", () => {
    expect(getDeliveryCurrencyLabel("en")).toBe("NIS");
    expect(getDeliveryCurrencyLabel("ar")).toBe("شيكل");
    expect(getFreeDeliveryLabel("en")).toBe("Free");
    expect(getFreeDeliveryLabel("ar")).toBe("مجاني");
    expect(getDeliveryAreaLabels("en").west_bank_cities.label).toBe(
      "West Bank cities",
    );
    expect(getDeliveryAreaLabels("ar").west_bank_cities.label).toBe(
      "مدن الضفة الغربية",
    );
  });

  it("formats delivery prices with caller-provided labels", () => {
    expect(formatDeliveryPriceNis(0, { free: "Free", currency: "NIS" })).toBe(
      "Free",
    );
    expect(formatDeliveryPriceNis(20, { free: "Free", currency: "NIS" })).toBe(
      "20 NIS",
    );
  });
});
