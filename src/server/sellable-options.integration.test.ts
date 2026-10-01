// @vitest-environment node
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import {
  lockOptionProduct,
  prepareOptionMutation,
} from "./sellable-option-mutation";
import { planOptionBackfill } from "~/lib/sellable-options";
import { getAdminInventoryPage } from "./admin-product-inventory";
import { adminProductsQuerySchema } from "./validations/product";

// No application URL/.env fallback and no schema operations. The operator must
// confirm this exact disposable target and apply the migration separately first.
const url = process.env.R6_TEST_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.R6_TEST_DATABASE_DISPOSABLE === "yes";
const db = enabled ? new PrismaClient({ datasourceUrl: url }) : undefined;
afterAll(async () => {
  await db?.$disconnect();
});

async function fixture(run: (productId: string) => Promise<void>) {
  const prefix = `r6-${randomUUID()}`;
  const category = await db!.category.create({
    data: { name: prefix, slug: prefix },
  });
  let productId: string | undefined;
  try {
    const product = await db!.product.create({
      data: {
        name: prefix,
        slug: prefix,
        price: 10,
        images: [],
        categoryId: category.id,
        stock: 99,
      },
    });
    productId = product.id;
    await run(product.id);
  } finally {
    if (productId) await db!.product.delete({ where: { id: productId } });
    await db!.category.delete({ where: { id: category.id } });
  }
}
async function create(
  productId: string,
  input: { isDefault?: boolean; optionLabel?: string; stock: number },
) {
  return db!.$transaction(async (tx) => {
    await lockOptionProduct(tx, productId);
    const data = await prepareOptionMutation(tx, productId, input);
    return tx.productVariant.create({ data: { ...data, productId } });
  });
}

describe.skipIf(!enabled)("R6 disposable PostgreSQL acceptance", () => {
  it("rolls back explicit sibling deactivation if the target write fails, then transitions atomically", async () =>
    fixture(async (productId) => {
      const old = await create(productId, { isDefault: true, stock: 4 });
      await expect(
        db!.$transaction(async (tx) => {
          await lockOptionProduct(tx, productId);
          const data = await prepareOptionMutation(tx, productId, {
            optionLabel: "Pins",
            stock: 3,
            deactivateOptionIds: [old.id],
          });
          await tx.productVariant.create({
            data: { ...data, productId, id: old.id },
          });
        }),
      ).rejects.toThrow();
      expect(
        await db!.productVariant.findUniqueOrThrow({ where: { id: old.id } }),
      ).toMatchObject({ isActive: true, stock: 4 });
      await db!.$transaction(async (tx) => {
        await lockOptionProduct(tx, productId);
        const data = await prepareOptionMutation(tx, productId, {
          optionLabel: "Pins",
          stock: 3,
          deactivateOptionIds: [old.id],
        });
        await tx.productVariant.create({ data: { ...data, productId } });
      });
      expect(
        await db!.productVariant.findUniqueOrThrow({ where: { id: old.id } }),
      ).toMatchObject({ isActive: false, stock: 4 });
      expect(
        await db!.productVariant.count({
          where: { productId, isActive: true },
        }),
      ).toBe(1);
    }));
  it("serializes concurrent default/named writes", async () =>
    fixture(async (productId) => {
      const results = await Promise.allSettled([
        create(productId, { isDefault: true, stock: 2 }),
        create(productId, { optionLabel: "Pins", stock: 3 }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect(await db!.productVariant.count({ where: { productId } })).toBe(1);
      expect(
        (await db!.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(99);
    }));
  it("serializes concurrent normalized duplicates", async () =>
    fixture(async (productId) => {
      const results = await Promise.allSettled([
        create(productId, { optionLabel: "PINS", stock: 2 }),
        create(productId, { optionLabel: "pins", stock: 3 }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    }));
  it("database guard rejects coexistence and identity conversion outside application helpers", async () =>
    fixture(async (productId) => {
      const option = await create(productId, { isDefault: true, stock: 2 });
      await expect(
        db!.productVariant.create({
          data: {
            productId,
            optionKey: "named:pins",
            optionLabel: "Pins",
            stock: 1,
          },
        }),
      ).rejects.toThrow();
      await expect(
        db!.productVariant.update({
          where: { id: option.id },
          data: { optionKey: "named:pins", optionLabel: "Pins" },
        }),
      ).rejects.toThrow();
    }));
  it("allows explicit deactivation/creation without transferring stock", async () =>
    fixture(async (productId) => {
      const option = await create(productId, { isDefault: true, stock: 2 });
      await db!.productVariant.update({
        where: { id: option.id },
        data: { isActive: false },
      });
      const named = await create(productId, { optionLabel: "Pins", stock: 3 });
      expect(named.stock).toBe(3);
      expect(
        (
          await db!.productVariant.findUniqueOrThrow({
            where: { id: option.id },
          })
        ).stock,
      ).toBe(2);
    }));
  it("backfills idempotently with collisions left unchanged", async () =>
    fixture(async (productId) => {
      for (const label of ["Pins", "PINS", "Angled", null])
        await db!.productVariant.create({
          data: { productId, sizeLabel: label, stock: 4 },
        });
      const rows = await db!.productVariant.findMany({ where: { productId } });
      const plan = planOptionBackfill(rows);
      expect(plan.unresolved).toHaveLength(3);
      await db!.$transaction(async (tx) => {
        await lockOptionProduct(tx, productId);
        for (const { id, ...data } of plan.changes)
          await tx.productVariant.update({ where: { id }, data });
      });
      const after = await db!.productVariant.findMany({ where: { productId } });
      expect(planOptionBackfill(after).changes).toEqual([]);
      expect(
        after.map((row) => [row.id, row.stock, row.isActive]).sort(),
      ).toEqual(rows.map((row) => [row.id, row.stock, row.isActive]).sort());
    }));
  it("retains conditional inventory protection under concurrent deductions", async () =>
    fixture(async (productId) => {
      const option = await create(productId, { isDefault: true, stock: 1 });
      const results = await Promise.all(
        [1, 2].map(() =>
          db!.productVariant.updateMany({
            where: {
              id: option.id,
              isActive: true,
              optionKey: "default",
              stock: { gte: 1 },
            },
            data: { stock: { decrement: 1 } },
          }),
        ),
      );
      expect(results.map((r) => r.count).sort()).toEqual([0, 1]);
      expect(
        (
          await db!.productVariant.findUniqueOrThrow({
            where: { id: option.id },
          })
        ).stock,
      ).toBe(0);
    }));
  it("R5 includes active neutral stock, excludes inactive stock and ignores Product.stock", async () =>
    fixture(async (productId) => {
      await create(productId, { optionLabel: "A", stock: 2 });
      const b = await create(productId, { optionLabel: "B", stock: 3 });
      await db!.productVariant.create({
        data: { productId, optionKey: "default", stock: 100, isActive: false },
      });
      const product = await db!.product.findUniqueOrThrow({
        where: { id: productId },
      });
      const filters = adminProductsQuerySchema.parse({
        categoryId: product.categoryId,
        stock: "low_stock",
      });
      const page = await db!.$transaction((tx) =>
        getAdminInventoryPage(tx, filters),
      );
      expect(page).toEqual({ total: 1, ids: [productId] });
      await db!.productVariant.update({
        where: { id: b.id },
        data: { stock: 4 },
      });
      expect(
        await db!.$transaction((tx) => getAdminInventoryPage(tx, filters)),
      ).toEqual({ total: 0, ids: [] });
    }));
});
