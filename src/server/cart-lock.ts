import { Prisma } from "@prisma/client";

// Every cart writer takes this lock FIRST, in the transaction that reads/writes
// the cart. PostgreSQL releases it on commit/rollback, including pooled sessions.
// A hash collision can only serialize unrelated carts, never split one cart's
// lock. Keep this namespace stable across application versions/instances.
export async function lockCustomerCart(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${`darakit:cart:${userId}`}, 0))
  `);
}
