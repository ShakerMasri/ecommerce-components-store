import { describe, expect, it } from "vitest";
import { buildAdminInventoryQueries } from "./admin-product-inventory";
import { adminProductsQuerySchema } from "./validations/product";

describe("admin inventory SQL", () => {
  it.each([
    ["newest", '"createdAt" DESC'],
    ["oldest", '"createdAt" ASC'],
    ["name_asc", '"name" ASC'],
    ["name_desc", '"name" DESC'],
    ["price_asc", '"price" ASC'],
    ["price_desc", '"price" DESC'],
    ["stock_asc", '"activeStock" ASC'],
    ["stock_desc", '"activeStock" DESC'],
  ])(
    "uses a unique tie-breaker before pagination for %s",
    (sort, expression) => {
      const { count, page } = buildAdminInventoryQueries(
        adminProductsQuerySchema.parse({ sort, page: 3, limit: 2 }),
      );
      expect(page.text).toContain(`ORDER BY ${expression}, "id" ASC`);
      expect(page.values.slice(-2)).toEqual([2, 4]);
      expect(count.text).not.toMatch(/LIMIT|OFFSET|ORDER BY/);
    },
  );

  it("parameterizes search/category/status and shares aggregate filters with the count", () => {
    const q = "' OR TRUE --";
    const categoryId = "clh1q2w3e000008l4a5b6c7d8";
    const { count, page } = buildAdminInventoryQueries(
      adminProductsQuerySchema.parse({
        q,
        categoryId,
        status: "archived",
        stock: "low_stock",
        sort: "stock_asc",
      }),
    );
    expect(page.text).not.toContain(q);
    expect(page.values).toEqual([
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      categoryId,
      true,
      20,
      0,
    ]);
    expect(count.values).toEqual(page.values.slice(0, -2));
    expect(count.text.split(" SELECT COUNT(*)")[0]).toBe(
      page.text.split(' SELECT "id" FROM filtered')[0],
    );
    expect(page.text).toContain('SUM(v."stock")');
    expect(page.text).toContain('v."isActive" = TRUE');
    expect(page.text).toContain('"activeStock" > 0 AND "activeStock" <= 5');
    expect(page.text).not.toContain('p."stock"');
  });
});
