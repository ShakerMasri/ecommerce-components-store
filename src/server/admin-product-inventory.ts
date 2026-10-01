import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { adminProductsQuerySchema } from "~/server/validations/product";

type Filters = z.infer<typeof adminProductsQuerySchema>;

// Only static SQL fragments may select columns/directions; all input values
// remain parameters. The unique ID resolves ties before LIMIT/OFFSET.
const ordering = {
  newest: Prisma.sql`"createdAt" DESC`,
  oldest: Prisma.sql`"createdAt" ASC`,
  name_asc: Prisma.sql`"name" ASC`,
  name_desc: Prisma.sql`"name" DESC`,
  price_asc: Prisma.sql`"price" ASC`,
  price_desc: Prisma.sql`"price" DESC`,
  stock_asc: Prisma.sql`"activeStock" ASC`,
  stock_desc: Prisma.sql`"activeStock" DESC`,
} satisfies Record<Filters["sort"], Prisma.Sql>;

export function buildAdminInventoryQueries(filters: Filters) {
  const predicates: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.q) {
    // Match Prisma's existing case-insensitive contains/LIKE semantics.
    const pattern = `%${filters.q}%`;
    predicates.push(Prisma.sql`(p."name" ILIKE ${pattern}
      OR p."slug" ILIKE ${pattern} OR p."description" ILIKE ${pattern})`);
  }
  if (filters.categoryId) {
    predicates.push(Prisma.sql`p."categoryId" = ${filters.categoryId}`);
  }
  if (filters.status !== "all") {
    predicates.push(
      Prisma.sql`p."isArchived" = ${filters.status === "archived"}`,
    );
  }

  const stockPredicate = {
    all: Prisma.sql`TRUE`,
    in_stock: Prisma.sql`"activeStock" > 0`,
    out_of_stock: Prisma.sql`"activeStock" = 0`,
    low_stock: Prisma.sql`"activeStock" > 0 AND "activeStock" <= 5`,
  }[filters.stock];

  // No legacy stock fallback: no variants and inactive-only variants both
  // contribute zero, exactly as on the storefront. Aggregate in PostgreSQL,
  // never by fetching the catalog or summing only an already-paginated page.
  const filtered = Prisma.sql`WITH inventory AS (
    SELECT p."id", p."name", p."price", p."createdAt",
      COALESCE((SELECT SUM(v."stock") FROM "ProductVariant" v
        WHERE v."productId" = p."id" AND v."isActive" = TRUE), 0) AS "activeStock"
    FROM "Product" p
    WHERE ${Prisma.join(predicates, " AND ")}
  ), filtered AS (
    SELECT * FROM inventory WHERE ${stockPredicate}
  )`;

  return {
    count: Prisma.sql`${filtered} SELECT COUNT(*) AS total FROM filtered`,
    page: Prisma.sql`${filtered} SELECT "id" FROM filtered
      ORDER BY ${ordering[filters.sort]}, "id" ASC
      LIMIT ${filters.limit} OFFSET ${(filters.page - 1) * filters.limit}`,
  };
}

// The caller owns the transaction so hydration uses the same snapshot.
export async function getAdminInventoryPage(
  tx: Prisma.TransactionClient,
  filters: Filters,
) {
  const queries = buildAdminInventoryQueries(filters);
  const [count] = await tx.$queryRaw<{ total: bigint }[]>(queries.count);
  const rows = await tx.$queryRaw<{ id: string }[]>(queries.page);
  return { total: Number(count!.total), ids: rows.map((row) => row.id) };
}
