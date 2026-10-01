// Node 24+ native TypeScript stripping; never loads .env or application DATABASE_URL.
import { PrismaClient, Prisma } from "@prisma/client";
import { planOptionBackfill } from "../src/lib/sellable-options.ts";

const url = process.env.R6_TEST_DATABASE_URL;
if (!url || process.env.R6_TEST_DATABASE_DISPOSABLE !== "yes") {
  throw new Error("An explicitly confirmed disposable R6 target is required.");
}
const apply = process.argv.includes("--apply");
const db = new PrismaClient({ datasourceUrl: url });
try {
  const products = await db.product.findMany({
    select: { id: true, stock: true },
    orderBy: { id: "asc" },
  });
  const report = {
    mode: apply ? "apply" : "report",
    candidateMappings: 0,
    mapped: 0,
    unresolved: [],
    legacyStock: [],
    productsWithoutOptions: [],
    unmappedOrVariantlessCarts: 0,
  };
  for (const product of products) {
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${product.id} FOR NO KEY UPDATE`,
      );
      const rows = await tx.productVariant.findMany({
        where: { productId: product.id },
      });
      const plan = planOptionBackfill(rows);
      if (apply)
        for (const { id, ...data } of plan.changes) {
          await tx.productVariant.update({ where: { id }, data });
        }
      return { ...plan, hasOptions: rows.length > 0 };
    });
    report.candidateMappings += result.changes.length;
    if (apply) report.mapped += result.changes.length;
    report.unresolved.push(...result.unresolved);
    if (!result.hasOptions)
      report.productsWithoutOptions.push({
        productId: product.id,
        reason: "no-option-inventory-requires-owner-reconciliation",
      });
    if (product.stock !== 0)
      report.legacyStock.push({
        productId: product.id,
        reason: "legacy-stock-requires-owner-reconciliation",
      });
  }
  report.unmappedOrVariantlessCarts = await db.cartItem.count({
    where: {
      OR: [{ productVariantId: null }, { productVariant: { optionKey: null } }],
    },
  });
  // IDs/reasons only; no credentials, account/cart details or catalog labels.
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : "unknown";
  process.stderr.write(
    `R6 backfill failed (${code}). Earlier product mappings may have committed; rerun the report before retrying.\n`,
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
