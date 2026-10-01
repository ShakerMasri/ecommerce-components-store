import { describe, expect, it } from "vitest";
import {
  createProductVariantSchema,
  updateProductVariantSchema,
} from "./product-variant";
import {
  normalizeOptionKey,
  isMappedOption,
  historicalOptionLabel,
  planOptionBackfill,
} from "~/lib/sellable-options";

describe("neutral option validation and compatibility", () => {
  it("creates an unlabeled default with bounded stock", () => {
    expect(
      createProductVariantSchema.parse({ isDefault: true, stock: "4" }),
    ).toMatchObject({ isDefault: true, optionLabel: null, stock: 4 });
    expect(
      createProductVariantSchema.safeParse({
        isDefault: true,
        optionLabel: "Fake",
        stock: 1,
      }).success,
    ).toBe(false);
  });
  it("requires a label for a named option and rejects clothing writes", () => {
    expect(createProductVariantSchema.safeParse({ stock: 1 }).success).toBe(
      false,
    );
    expect(
      createProductVariantSchema.safeParse({
        sizeLabel: "M",
        colorLabel: "Black",
        stock: 1,
      }).success,
    ).toBe(false);
    expect(
      createProductVariantSchema.parse({
        optionLabel: " Straight pins ",
        stock: "3",
      }).optionLabel,
    ).toBe("Straight pins");
  });
  it.each([-1, 1.5, 1000001])("rejects invalid stock %s", (stock) => {
    expect(
      createProductVariantSchema.safeParse({ isDefault: true, stock }).success,
    ).toBe(false);
  });
  it("does not inject defaults into partial updates", () => {
    expect(updateProductVariantSchema.parse({ stock: 2 })).toEqual({
      stock: 2,
    });
    expect(updateProductVariantSchema.safeParse({}).success).toBe(false);
  });
  it("rejects raw and normalized labels that exceed storage bounds", () => {
    expect(
      createProductVariantSchema.safeParse({
        optionLabel: "x".repeat(161),
        stock: 1,
      }).success,
    ).toBe(false);
    expect(
      createProductVariantSchema.safeParse({
        optionLabel: "\ufdfa".repeat(12),
        stock: 1,
      }).success,
    ).toBe(false);
  });
  it("normalizes Unicode compatibility forms, casing and whitespace without stripping labels", () => {
    expect(normalizeOptionKey("  FULL   Width ")).toBe("named:full width");
    expect(normalizeOptionKey("\uff21\uff22")).toBe(normalizeOptionKey("AB"));
    expect(normalizeOptionKey("\u0645\u0648\u0635\u0644")).toBe(
      "named:\u0645\u0648\u0635\u0644",
    );
    expect(isMappedOption({ optionKey: null, optionLabel: null })).toBe(false);
  });
  it("reads only immutable neutral or legacy historical snapshots", () => {
    const legacy = { selectedSizeLabel: "M", selectedColorLabel: "Black" };
    expect(historicalOptionLabel(legacy)).toBe("M / Black");
    expect(
      historicalOptionLabel({
        ...legacy,
        selectedOptionLabel: "Straight pins",
      }),
    ).toBe("Straight pins");
    expect(
      historicalOptionLabel({
        selectedOptionLabel: null,
        selectedSizeLabel: null,
        selectedColorLabel: null,
      }),
    ).toBeNull();
  });
  it("backfills idempotently, reports collisions/blank labels and never guesses defaults", () => {
    const base = {
      productId: "p",
      optionKey: null,
      optionLabel: null,
      colorLabel: null,
    };
    const rows = [
      { ...base, id: "a", sizeLabel: "Pins" },
      { ...base, id: "b", sizeLabel: " PINS " },
      { ...base, id: "c", sizeLabel: null },
      { ...base, id: "d", sizeLabel: "Angled" },
    ];
    const plan = planOptionBackfill(rows);
    expect(plan.changes).toEqual([
      { id: "d", optionLabel: "Angled", optionKey: "named:angled" },
    ]);
    expect(plan.unresolved).toEqual([
      { id: "a", reason: "normalized-key-collision" },
      { id: "b", reason: "normalized-key-collision" },
      { id: "c", reason: "blank-or-overlong-label" },
    ]);
    expect(
      planOptionBackfill(
        rows.map((row) =>
          row.id === "d" ? { ...row, ...plan.changes[0] } : row,
        ),
      ).changes,
    ).toEqual([]);
    expect(
      planOptionBackfill([
        { ...base, id: "a", sizeLabel: "Pins" },
        {
          ...base,
          id: "mapped",
          sizeLabel: null,
          optionLabel: "Pins",
          optionKey: "named:pins",
        },
      ]).changes,
    ).toEqual([]);
  });
});
