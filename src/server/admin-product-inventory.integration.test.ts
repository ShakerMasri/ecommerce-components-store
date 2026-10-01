// @vitest-environment node
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { getAdminInventoryPage } from "./admin-product-inventory";
import { adminProductsQuerySchema } from "./validations/product";

// Opt in only after the operator confirms this exact target is disposable.
// Never fall back to DATABASE_URL or load application environment files.
const url = process.env.R5_TEST_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.R5_TEST_DATABASE_DISPOSABLE === "yes";
const db = enabled ? new PrismaClient({ datasourceUrl: url }) : undefined;

afterAll(async () => {
  await db?.$disconnect();
});

async function withInventory(
  run: (
    tx: Prisma.TransactionClient,
    categoryId: string,
    ids: Record<string, string>,
  ) => Promise<void>,
) {
  const rollback = new Error("Rollback R5 disposable fixtures");
  try {
    await db!.$transaction(
      async (tx) => {
        const prefix = `r5-${randomUUID()}`;
        const category = await tx.category.create({
          data: { name: prefix, slug: prefix },
        });
        const other = await tx.category.create({
          data: { name: `${prefix}-other`, slug: `${prefix}-other` },
        });
        const ids: Record<string, string> = {};
        const fixtures = [
          { key: "a", stock: 99, variants: [] },
          { key: "b", stock: 99, variants: [[9, false]] },
          { key: "c", stock: 99, variants: [[0, true]] },
          {
            key: "d",
            stock: 0,
            variants: [
              [1, true],
              [100, false],
            ],
          },
          {
            key: "e",
            stock: 0,
            variants: [
              [2, true],
              [3, true],
              [100, false],
            ],
          },
          { key: "f", stock: 1, variants: [[6, true]] },
          { key: "g", stock: 100, variants: [[5, true]] },
          { key: "h", stock: 0, variants: [[1, true]] },
          { key: "i", stock: 0, variants: [[1, true]] },
        ] satisfies {
          key: string;
          stock: number;
          variants: [number, boolean][];
        }[];
        for (const fixture of fixtures) {
          const id = `${prefix}-${fixture.key}`;
          ids[fixture.key] = id;
          await tx.product.create({
            data: {
              id,
              name:
                fixture.key === "d" || fixture.key === "i"
                  ? "Sensor"
                  : "Component",
              slug: fixture.key === "f" ? `${id}-sensor` : id,
              description: fixture.key === "e" ? "SENSOR module" : null,
              price: 10,
              stock: fixture.stock,
              images: [],
              categoryId: fixture.key === "i" ? other.id : category.id,
              isArchived: fixture.key === "h",
              createdAt: new Date("2026-01-01"),
              variants: {
                create: fixture.variants.map(([stock, isActive], index) => ({
                  stock,
                  isActive,
                  sizeKey: String(index),
                })),
              },
            },
          });
        }
        await run(tx, category.id, ids);
        throw rollback;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30_000,
      },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe.skipIf(!enabled)(
  "admin inventory query on disposable PostgreSQL",
  () => {
    it.each([
      ["all", ["a", "b", "c", "d", "e", "g", "f"]],
      ["out_of_stock", ["a", "b", "c"]],
      ["in_stock", ["d", "e", "g", "f"]],
      ["low_stock", ["d", "e", "g"]],
    ])(
      "filters/counts %s using active sums (0/1/5/6), ignoring legacy stock",
      async (stock, keys) => {
        await withInventory(async (tx, categoryId, ids) => {
          const result = await getAdminInventoryPage(
            tx,
            adminProductsQuerySchema.parse({
              categoryId,
              status: "active",
              stock,
              sort: "stock_asc",
            }),
          );
          expect(result).toEqual({
            total: keys.length,
            ids: keys.map((key) => ids[key]),
          });
        });
      },
    );

    it.each([
      ["stock_asc", ["a", "b", "c", "d", "e", "g", "f"]],
      ["stock_desc", ["f", "e", "g", "d", "a", "b", "c"]],
    ])(
      "sorts %s globally with stable ties across pages",
      async (sort, keys) => {
        await withInventory(async (tx, categoryId, ids) => {
          const actual: string[] = [];
          for (let page = 1; page <= 5; page++) {
            const filters = adminProductsQuerySchema.parse({
              categoryId,
              status: "active",
              sort,
              page,
              limit: 2,
            });
            const result = await getAdminInventoryPage(tx, filters);
            expect(result.total).toBe(7);
            expect(result.ids).toEqual(
              keys.slice((page - 1) * 2, page * 2).map((key) => ids[key]),
            );
            expect(await getAdminInventoryPage(tx, filters)).toEqual(result);
            actual.push(...result.ids);
          }
          expect(actual).toEqual(keys.map((key) => ids[key]));
          expect(new Set(actual).size).toBe(7);
        });
      },
    );

    it("combines search/category/status/stock before counting and paging", async () => {
      await withInventory(async (tx, categoryId, ids) => {
        const filters = adminProductsQuerySchema.parse({
          categoryId,
          status: "active",
          q: "sEnSoR",
          stock: "low_stock",
          sort: "stock_desc",
          limit: 1,
        });
        expect(await getAdminInventoryPage(tx, filters)).toEqual({
          total: 2,
          ids: [ids.e],
        });
        expect(
          await getAdminInventoryPage(tx, { ...filters, page: 2 }),
        ).toEqual({ total: 2, ids: [ids.d] });
        expect(
          await getAdminInventoryPage(tx, { ...filters, page: 3 }),
        ).toEqual({ total: 2, ids: [] });
        expect(
          await getAdminInventoryPage(tx, {
            ...filters,
            stock: "in_stock",
            limit: 20,
          }),
        ).toEqual({ total: 3, ids: [ids.f, ids.e, ids.d] });
        expect(
          await getAdminInventoryPage(tx, {
            ...filters,
            q: undefined,
            status: "archived",
          }),
        ).toEqual({ total: 1, ids: [ids.h] });
        expect(
          await getAdminInventoryPage(tx, { ...filters, q: "no-match" }),
        ).toEqual({ total: 0, ids: [] });
      });
    });
  },
);
