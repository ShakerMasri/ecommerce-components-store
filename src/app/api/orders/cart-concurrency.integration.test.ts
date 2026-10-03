// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDeliveryAreaByKey } from "~/lib/delivery";
import { lockCustomerCart } from "~/server/cart-lock";

// Handler/database coverage, not authenticated HTTP or live-service acceptance.
// Prisma is injected with a REAL client/transaction proxy: only scheduling is
// intercepted, at real lock attempts/acquisition. No rows, writes, results, isolation or
// commit/rollback behavior are fabricated. External auth/Redis/email boundaries
// are stubbed; request validation, CSRF, pricing and delivery config stay real.
const boundary = vi.hoisted(() => ({
  userId: "",
  handlerDb: undefined as PrismaClient | undefined,
  attempts: [] as { pid: number; acquired: boolean }[],
  onAttempt: undefined as (() => void) | undefined,
  afterLock: undefined as ((index: number) => Promise<void>) | undefined,
}));
vi.mock("~/server/auth", () => ({
  auth: async () => ({ user: { id: boundary.userId } }),
}));
vi.mock("~/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true }),
}));
vi.mock("~/server/email", () => ({
  sendCustomerOrderReceiptEmail: async () => undefined,
  sendOrderNotificationEmail: async () => undefined,
}));
vi.mock("~/env", () => ({
  env: { NODE_ENV: "test", APP_URL: "http://localhost:3000" },
}));
vi.mock("~/lib/prisma", () => ({
  get prisma() {
    if (!boundary.handlerDb) throw new Error("R8 database not enabled");
    return boundary.handlerDb;
  },
}));
import { POST as checkout } from "./route";
import { POST as addLine } from "../cart/items/route";
import {
  PATCH as updateLine,
  DELETE as removeLine,
} from "../cart/items/[id]/route";

const DATABASE = "components_r8_cart_races_20261002";
const url = process.env.R8_TEST_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.R8_TEST_DATABASE_DISPOSABLE === "yes";
const artifactDir = process.env.R8_TEST_ARTIFACT_DIR;
if (enabled) {
  const target = new URL(url!);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "5437" ||
    target.pathname !== `/${DATABASE}` ||
    [...target.searchParams.keys()].some((key) => key !== "schema") ||
    (target.searchParams.has("schema") &&
      target.searchParams.get("schema") !== "public")
  ) {
    throw new Error("R8 URL must match the exact owner-approved target");
  }
  const relative = artifactDir && path.relative(process.cwd(), artifactDir);
  if (
    !artifactDir ||
    !path.isAbsolute(artifactDir) ||
    !relative ||
    !(
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
  ) {
    throw new Error(
      "R8 requires a private artifact directory outside the repository",
    );
  }
  // Prevent any accidental application-client fallback in this worker.
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
const db = enabled ? new PrismaClient({ datasourceUrl: url }) : undefined;
const runId = `r8-${randomUUID()}`;
const STOCK = 100;
const WAIT_MS = 5_000;
const TEST_MS = 30_000;

function transactionWithBarrier(tx: Prisma.TransactionClient) {
  return new Proxy(tx, {
    get(target, property, receiver) {
      if (property === "$executeRaw") {
        return async (...args: unknown[]) => {
          const [backend] = await target.$queryRaw<{ pid: number }[]>`
            SELECT pg_backend_pid() AS pid
          `;
          const index = boundary.attempts.length;
          const attempt = { pid: backend!.pid, acquired: false };
          boundary.attempts.push(attempt);
          boundary.onAttempt?.();
          // Await the actual PostgreSQL lock query; no synthetic lock result.
          const result: unknown = await Reflect.apply(
            target.$executeRaw.bind(target),
            target,
            args,
          );
          attempt.acquired = true;
          await boundary.afterLock?.(index);
          return result;
        };
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Harness timeout: ${label}`)),
      WAIT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(
          error instanceof Error
            ? error
            : new Error("Harness operation rejected"),
        );
      },
    );
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function barrier(expectedReads: number) {
  const reached = deferred();
  const release = deferred();
  let reads = 0;
  return {
    wait: () => bounded(reached.promise, "first cart lock acquired"),
    release: release.resolve,
    block: async () => {
      if (++reads === expectedReads) reached.resolve();
      await bounded(release.promise, "release first cart lock");
    },
    count: () => reads,
  };
}

async function evidence(file: string, value: unknown) {
  await writeFile(
    path.join(artifactDir!, `${runId}-${file}.json`),
    JSON.stringify(value, null, 2),
  );
}

type Baseline = Record<string, { count: number; sha256: string }>;
async function baseline(): Promise<Baseline> {
  const tables = await db!.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const result: Baseline = {};
  for (const { tablename } of tables) {
    if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(tablename))
      throw new Error("Unexpected table identifier");
    // Identifier comes only from the database catalog and is checked above.
    const rows = await db!.$queryRawUnsafe<{ row: string }[]>(
      `SELECT to_jsonb(t)::text AS row FROM public."${tablename}" t ORDER BY to_jsonb(t)::text`,
    );
    result[tablename] = {
      count: rows.length,
      sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }
  return result;
}

let initial: Baseline;
beforeAll(async () => {
  if (!db) return;
  await mkdir(artifactDir!, { recursive: true });
  const [target] = await db.$queryRaw<
    { database: string; isolation: string }[]
  >`
    SELECT current_database() AS database, current_setting('transaction_isolation') AS isolation
  `;
  expect(target?.database).toBe(DATABASE);
  expect(target?.isolation).toBe("read committed");
  initial = await baseline();
  await evidence("baseline", { target, tables: initial });
  boundary.handlerDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property === "$transaction") {
        return (run: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          target.$transaction((tx) => run(transactionWithBarrier(tx)), {
            maxWait: WAIT_MS,
            timeout: 12_000,
          });
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
});
afterAll(async () => {
  if (!db) return;
  try {
    const final = await baseline();
    await evidence("final-preservation", {
      tables: final,
      matches: JSON.stringify(final) === JSON.stringify(initial),
    });
    expect(final, "all original public-table rows must be preserved").toEqual(
      initial,
    );
  } finally {
    boundary.handlerDb = undefined;
    await db.$disconnect();
  }
});

const cuid = () => `c${randomUUID().replaceAll("-", "")}`;
type Fixture = {
  userId: string;
  categoryId: string;
  products: [string, string];
  variants: [string, string];
  cartIds: string[];
  orderIds: string[];
  stock: [number, number];
  tag: string;
  tasks: Promise<unknown>[];
  gates: ReturnType<typeof barrier>[];
};

async function fixture(name: string, run: (f: Fixture) => Promise<void>) {
  const f: Fixture = {
    userId: cuid(),
    categoryId: cuid(),
    products: [cuid(), cuid()],
    variants: [cuid(), cuid()],
    cartIds: [cuid()],
    orderIds: [],
    stock: [STOCK, STOCK],
    tag: `${runId}-${name}`,
    tasks: [],
    gates: [],
  };
  boundary.userId = f.userId;
  boundary.attempts = [];
  await evidence(`${name}-fixtures`, f);
  try {
    await db!.user.create({
      data: {
        id: f.userId,
        name: f.tag,
        email: `${f.tag}@example.invalid`,
        emailVerified: true,
        phone: "+970599000000",
      },
    });
    await db!.category.create({
      data: { id: f.categoryId, name: f.tag, slug: f.tag },
    });
    for (const index of [0, 1] as const) {
      await db!.product.create({
        data: {
          id: f.products[index],
          name: `${f.tag}-${index}`,
          slug: `${f.tag}-${index}`,
          categoryId: f.categoryId,
          price: 10 + index,
          images: [],
          stock: 0,
          variants: {
            create: {
              id: f.variants[index],
              optionKey: index === 0 ? "default" : "named:synthetic pins",
              optionLabel: index === 0 ? null : "Synthetic pins",
              stock: STOCK,
            },
          },
        },
      });
    }
    await db!.cartItem.create({
      data: {
        id: f.cartIds[0],
        userId: f.userId,
        productId: f.products[0],
        productVariantId: f.variants[0],
        cartLineKey: `variant:${f.variants[0]}`,
        quantity: 2,
      },
    });
    await run(f);
  } finally {
    // Release and drain EVERY started handler before cleanup, even on assertions
    // or barrier failure. Real transactions also have their own bounded timeout.
    boundary.afterLock = undefined;
    boundary.onAttempt = undefined;
    for (const gate of f.gates) gate.release();
    const settled = await Promise.allSettled(f.tasks);
    const pids = boundary.attempts.map((attempt) => attempt.pid);
    let remainingLockCount = 0;
    if (pids.length) {
      const [remaining] = await db!.$queryRaw<{ count: number }[]>`
        SELECT count(*)::integer AS count FROM pg_locks
        WHERE pid = ANY(${pids}::integer[]) AND locktype = 'advisory'
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `;
      remainingLockCount = remaining!.count;
      await evidence(`${name}-released-locks`, { count: remaining!.count });
      // Check after cleanup below so even a faulty session-lock implementation
      // cannot prevent removal of this fixture's data.
    }
    const orders = await db!.order.findMany({
      where: { userId: f.userId },
      select: { id: true },
    });
    f.orderIds = orders.map(({ id }) => id);
    const carts = await db!.cartItem.findMany({
      where: { userId: f.userId },
      select: { id: true },
    });
    f.cartIds = [...new Set([...f.cartIds, ...carts.map(({ id }) => id)])];
    await evidence(`${name}-fixtures`, {
      ...f,
      tasks: settled.map((result) => ({ status: result.status })),
      gates: f.gates.map((gate) => ({ acquisitions: gate.count() })),
      locks: boundary.attempts,
    });
    // Each deletion uses this fixture's recorded IDs; never clear a table/cart
    // wholesale, reset a database, or touch another customer's records.
    await db!.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { orderId: { in: f.orderIds } },
        select: { id: true },
      });
      await evidence(`${name}-order-items`, items);
      await tx.orderItem.deleteMany({
        where: { id: { in: items.map(({ id }) => id) } },
      });
      await tx.order.deleteMany({
        where: { id: { in: f.orderIds }, userId: f.userId },
      });
      await tx.cartItem.deleteMany({
        where: { id: { in: f.cartIds }, userId: f.userId },
      });
      await tx.productVariant.deleteMany({
        where: { id: { in: f.variants }, productId: { in: f.products } },
      });
      await tx.product.deleteMany({
        where: { id: { in: f.products }, categoryId: f.categoryId },
      });
      await tx.category.deleteMany({ where: { id: f.categoryId } });
      await tx.user.deleteMany({
        where: { id: f.userId, email: `${f.tag}@example.invalid` },
      });
    });
    const restored = await baseline();
    await evidence(`${name}-cleanup`, {
      matches: JSON.stringify(restored) === JSON.stringify(initial),
      tables: restored,
    });
    expect(
      restored,
      `${name}: fixture cleanup must restore the private baseline`,
    ).toEqual(initial);
    expect(
      remainingLockCount,
      "commit/rollback must release transaction advisory locks",
    ).toBe(0);
  }
}

function request(method: string, pathname: string, body?: unknown) {
  return new Request(`http://localhost:3000${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function purchase(f: Fixture, idempotencyKey = randomUUID()) {
  const task = checkout(
    request("POST", "/api/orders", {
      idempotencyKey,
      phone: "+970599000000",
      deliveryAreaKey: "west_bank_cities",
      deliveryCity: "Synthetic test city",
      deliveryAddress: "Synthetic test address",
    }),
  );
  f.tasks.push(task);
  return task;
}
function holdFirstLock(f: Fixture) {
  const gate = barrier(1);
  f.gates.push(gate);
  boundary.afterLock = async (index) => {
    if (index === 0) await gate.block();
  };
  return gate;
}

async function waitForBlockedLock(f: Fixture) {
  const attempted = deferred();
  boundary.onAttempt = () => {
    if (boundary.attempts.length >= 2) attempted.resolve();
  };
  if (boundary.attempts.length >= 2) attempted.resolve();
  await bounded(attempted.promise, "competing operation attempts lock");
  const [holder, waiter] = boundary.attempts;
  expect(holder!.acquired).toBe(true);
  expect(waiter!.pid).not.toBe(holder!.pid);
  const deadline = Date.now() + WAIT_MS;
  // Poll actual lock metadata via bounded database round trips, with no sleeps.
  // An attempted operation alone does not prove concurrency: the second backend
  // must be waiting on THIS first backend's advisory lock before it is released.
  while (Date.now() < deadline) {
    const [state] = await bounded(
      db!.$queryRaw<{ waiting: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_locks
        WHERE pid = ${waiter!.pid} AND locktype = 'advisory' AND NOT granted
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      ) AND ${holder!.pid}::integer = ANY(pg_blocking_pids(${waiter!.pid}::integer)) AS waiting
    `,
      "read lock wait metadata",
    );
    if (state!.waiting) {
      expect(waiter!.acquired).toBe(false);
      await evidence(`${f.tag.slice(runId.length + 1)}-lock-wait`, {
        holder: holder!.pid,
        waiter: waiter!.pid,
        waiting: true,
      });
      return;
    }
  }
  throw new Error(
    "Harness timeout: competing backend did not wait on cart lock",
  );
}

async function observe(f: Fixture, responses: Response[]) {
  const orders = await db!.order.findMany({
    where: { userId: f.userId },
    include: { items: true },
  });
  const carts = await db!.cartItem.findMany({ where: { userId: f.userId } });
  const variants = await db!.productVariant.findMany({
    where: { id: { in: f.variants } },
  });
  const key = (id: string | null) =>
    f.variants.indexOf(id!) === 0 ? "a" : "b";
  const lines = (
    items: { productVariantId: string | null; quantity: number }[],
  ) =>
    items
      .map((item) => ({
        option: key(item.productVariantId),
        quantity: item.quantity,
      }))
      .sort((a, b) => a.option.localeCompare(b.option));
  const actual = {
    statuses: responses.map((response) => response.status),
    orders: orders.map((order) => lines(order.items)),
    cart: lines(carts),
    stock: f.variants.map(
      (id) => variants.find((variant) => variant.id === id)!.stock,
    ),
  };
  const bodies: unknown[] = await Promise.all(
    responses.map((response) => response.clone().json() as Promise<unknown>),
  );
  // Only synthetic data. Persist the complete observation privately before any
  // assertions, so application failures and cleanup are independently inspectable.
  await evidence(`${f.tag.slice(runId.length + 1)}-observation`, {
    actual,
    bodies,
    orders,
    carts,
    variants,
  });
  for (const response of responses) {
    expect(
      [200, 400, 404, 409],
      "unexpected response is not a valid race outcome",
    ).toContain(response.status);
  }
  for (const order of orders) {
    expect(order.stockDeductedAt).not.toBeNull();
    let subtotal = 0;
    for (const item of order.items) {
      const index = f.variants.indexOf(item.productVariantId!);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(item.productId).toBe(f.products[index]);
      expect(item.productNameAtPurchase).toBe(`${f.tag}-${index}`);
      expect(item.productSlugAtPurchase).toBe(`${f.tag}-${index}`);
      expect(item.selectedOptionLabel).toBe(
        index === 0 ? null : "Synthetic pins",
      );
      expect(item.priceAtPurchase.toNumber()).toBe(10 + index);
      expect(item.subtotalAmount.toNumber()).toBe((10 + index) * item.quantity);
      subtotal += item.subtotalAmount.toNumber();
    }
    expect(order.deliveryPrice.toNumber()).toBe(
      getDeliveryAreaByKey("west_bank_cities")!.priceNis,
    );
    expect(order.totalAmount.toNumber()).toBe(
      subtotal + order.deliveryPrice.toNumber(),
    );
  }
  for (const [index, id] of f.variants.entries()) {
    const purchased = orders
      .flatMap((order) => order.items)
      .filter((item) => item.productVariantId === id)
      .reduce((sum, item) => sum + item.quantity, 0);
    expect(actual.stock[index]).toBe(f.stock[index]! - purchased);
    expect(actual.stock[index]).toBeGreaterThanOrEqual(0);
  }
  const checkoutBody = bodies[0] as { order?: { id: string } };
  expect(responses[0]!.ok).toBe(Boolean(checkoutBody.order));
  if (checkoutBody.order)
    expect(orders.map((order) => order.id)).toContain(checkoutBody.order.id);
  for (const body of bodies) {
    const returned = (
      body as {
        order?: {
          id: string;
          items: {
            id: string;
            quantity: number;
            productVariantId: string | null;
            selectedOptionLabel: string | null;
            priceAtPurchase: string;
            subtotalAmount: string;
          }[];
        };
      }
    ).order;
    if (!returned) continue;
    const persisted = orders.find((order) => order.id === returned.id);
    expect(
      persisted,
      "returned order must actually be committed",
    ).toBeDefined();
    const snapshots = persisted!.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      productVariantId: item.productVariantId,
      selectedOptionLabel: item.selectedOptionLabel,
      priceAtPurchase: item.priceAtPurchase.toString(),
      subtotalAmount: item.subtotalAmount.toString(),
    }));
    expect(returned.items).toHaveLength(snapshots.length);
    expect(returned.items).toEqual(
      expect.arrayContaining(
        snapshots.map((item) => expect.objectContaining(item)),
      ),
    );
  }
  return actual;
}

type Mutation = "quantity" | "removal" | "addition";
function serialOutcomes(
  mutation: Mutation,
  checkoutOk: boolean,
  mutationStatus: number,
) {
  // Try both total orders. Removal ensures absence; it does not cancel an order.
  // Already-absent deletion is an idempotent effect (this API returns 404).
  // Do not infer a defect from a checkout/removal pair solely because deletion
  // was acknowledged. Quantity edits, unlike removal, require a surviving line.
  return [true, false].flatMap((mutationFirst) => {
    const cart: Record<string, number> = { a: 2 };
    let order: { option: string; quantity: number }[] | undefined;
    const stock = [STOCK, STOCK];
    let valid = true;
    const edit = () => {
      if (mutation === "removal") {
        if (cart.a) {
          if (mutationStatus === 200) delete cart.a;
          else if (mutationStatus !== 409) valid = false;
        } else if (![200, 404, 409].includes(mutationStatus)) valid = false;
        return;
      }
      if (mutationStatus !== 200) return;
      if (mutation === "addition") cart.b = 1;
      else if (!cart.a) valid = false;
      else cart.a = 3;
    };
    const buy = () => {
      if (!checkoutOk) return;
      if (!Object.keys(cart).length) {
        valid = false;
        return;
      }
      order = Object.entries(cart).map(([option, quantity]) => ({
        option,
        quantity,
      }));
      stock[0] = STOCK - (cart.a ?? 0);
      stock[1] = STOCK - (cart.b ?? 0);
      for (const option of Object.keys(cart)) delete cart[option];
    };
    if (mutationFirst) {
      edit();
      buy();
    } else {
      buy();
      edit();
    }
    return valid
      ? [
          {
            orders: order ? [order] : [],
            cart: Object.entries(cart).map(([option, quantity]) => ({
              option,
              quantity,
            })),
            stock,
          },
        ]
      : [];
  });
}

describe
  .skipIf(!enabled)
  .sequential("R8 real PostgreSQL cart/checkout races", () => {
    it(
      "consumes one customer's cart only once with different keys and ample stock",
      async () =>
        fixture("different-keys", async (f) => {
          const gate = holdFirstLock(f);
          const first = purchase(f);
          await gate.wait();
          const second = purchase(f);
          await waitForBlockedLock(f);
          gate.release();
          const responses = await Promise.all([first, second]);
          const actual = await observe(f, responses);
          expect(
            actual.orders,
            "two keys must not buy the same cart snapshot twice",
          ).toHaveLength(1);
          expect(actual.orders[0]).toEqual([{ option: "a", quantity: 2 }]);
          expect(actual.stock).toEqual([98, 100]);
          expect(actual.cart).toEqual([]);
          // Distinct keys may be rejected or resolve to one purchase, never two.
          const ids = await Promise.all(
            responses
              .filter((response) => response.ok)
              .map(async (response) => {
                const body = (await response.clone().json()) as {
                  order: { id: string };
                };
                return body.order.id;
              }),
          );
          expect(new Set(ids).size).toBe(1);
        }),
      TEST_MS,
    );

    it.each([
      { mutation: "quantity", first: "checkout" },
      { mutation: "quantity", first: "mutation" },
      { mutation: "removal", first: "checkout" },
      { mutation: "removal", first: "mutation" },
      { mutation: "addition", first: "checkout" },
      { mutation: "addition", first: "mutation" },
    ] as const)(
      "$mutation race, $first acquires the lock first, matches a serial ordering",
      async ({ mutation, first }) =>
        fixture(`${mutation}-${first}`, async (f) => {
          const gate = holdFirstLock(f);
          const itemPath = `/api/cart/items/${f.cartIds[0]}`;
          const context = { params: Promise.resolve({ id: f.cartIds[0]! }) };
          const edit = () => {
            const task =
              mutation === "quantity"
                ? updateLine(
                    request("PATCH", itemPath, { quantity: 3 }),
                    context,
                  )
                : mutation === "removal"
                  ? removeLine(request("DELETE", itemPath), context)
                  : addLine(
                      request("POST", "/api/cart/items", {
                        productId: f.products[1],
                        productVariantId: f.variants[1],
                        quantity: 1,
                      }),
                    );
            f.tasks.push(task);
            return task;
          };
          let buying: Promise<Response>;
          let editing: Promise<Response>;
          if (first === "checkout") {
            buying = purchase(f);
            await gate.wait();
            editing = edit();
          } else {
            editing = edit();
            await gate.wait();
            buying = purchase(f);
          }
          // Both handlers are active, on different PostgreSQL backends. The
          // contender is proven to wait before either transaction can commit.
          await waitForBlockedLock(f);
          gate.release();
          const [checkoutResponse, editResponse] = await Promise.all([
            buying,
            editing,
          ]);
          const observation = await observe(f, [
            checkoutResponse,
            editResponse,
          ]);
          const actual = {
            orders: observation.orders,
            cart: observation.cart,
            stock: observation.stock,
          };
          if (editResponse.ok && mutation !== "removal") {
            const body = (await editResponse.clone().json()) as {
              cartItem: { quantity: number; productVariantId: string };
            };
            expect(body.cartItem.quantity).toBe(
              mutation === "quantity" ? 3 : 1,
            );
            expect(body.cartItem.productVariantId).toBe(
              f.variants[mutation === "quantity" ? 0 : 1],
            );
          }
          const allowed = serialOutcomes(
            mutation,
            checkoutResponse.ok,
            editResponse.status,
          );
          expect(
            allowed,
            "acknowledged cart changes and checkout must have a valid serial history",
          ).toContainEqual(actual);
          if (mutation === "removal") {
            // Preserve the actual API contract: removing an already consumed
            // line returns 404, while removal before checkout returns 200 and
            // checkout sees an empty cart. Removal never cancels an order.
            expect(editResponse.status).toBe(first === "checkout" ? 404 : 200);
            expect(checkoutResponse.status).toBe(
              first === "checkout" ? 200 : 400,
            );
          }
        }),
      TEST_MS,
    );

    it(
      "rechecks a same-key retry after waiting and commits one purchase",
      async () =>
        fixture("same-key", async (f) => {
          const gate = holdFirstLock(f);
          const key = randomUUID();
          const first = purchase(f, key);
          await gate.wait();
          const retry = purchase(f, key);
          await waitForBlockedLock(f);
          gate.release();
          const responses = await Promise.all([first, retry]);
          const actual = await observe(f, responses);
          expect(actual.statuses).toEqual([200, 200]);
          expect(actual.orders).toEqual([[{ option: "a", quantity: 2 }]]);
          expect(actual.stock).toEqual([98, 100]);
          expect(actual.cart).toEqual([]);
          const ids = await Promise.all(
            responses.map(
              async (response) =>
                ((await response.clone().json()) as { order: { id: string } })
                  .order.id,
            ),
          );
          expect(new Set(ids).size).toBe(1);
        }),
      TEST_MS,
    );

    it(
      "releases the cart lock on checkout rollback so a waiting edit can commit",
      async () =>
        fixture("rollback", async (f) => {
          const original = await db!.cartItem.findUniqueOrThrow({
            where: { id: f.cartIds[0] },
          });
          const secondId = cuid();
          f.cartIds.push(secondId);
          await evidence("rollback-extra-fixture-ids", { cartIds: f.cartIds });
          await db!.cartItem.create({
            data: {
              id: secondId,
              userId: f.userId,
              productId: f.products[1],
              productVariantId: f.variants[1],
              cartLineKey: `variant:${f.variants[1]}`,
              quantity: 1,
              createdAt: new Date(original.createdAt.getTime() + 1_000),
            },
          });
          // The second reservation fails AFTER the first option is deducted;
          // rollback must preserve the cart/stock and release the advisory lock.
          await db!.productVariant.update({
            where: { id: f.variants[1] },
            data: { stock: 0 },
          });
          f.stock[1] = 0;
          const gate = holdFirstLock(f);
          const buying = purchase(f);
          await gate.wait();
          const editing = updateLine(
            request("PATCH", `/api/cart/items/${f.cartIds[0]}`, {
              quantity: 3,
            }),
            {
              params: Promise.resolve({ id: f.cartIds[0]! }),
            },
          );
          f.tasks.push(editing);
          await waitForBlockedLock(f);
          gate.release();
          const responses = await Promise.all([buying, editing]);
          const actual = await observe(f, responses);
          expect(actual.statuses).toEqual([400, 200]);
          const failed = (await responses[0].clone().json()) as {
            message: string;
          };
          expect(failed.message).toMatch(/stock/i);
          expect(actual.orders).toEqual([]);
          expect(actual.cart).toEqual([
            { option: "a", quantity: 3 },
            { option: "b", quantity: 1 },
          ]);
          expect(actual.stock).toEqual([100, 0]);
        }),
      TEST_MS,
    );

    it(
      "locks separate customer identities independently",
      async () =>
        fixture("independent-carts", async (f) => {
          const gate = barrier(1);
          f.gates.push(gate);
          const holding = db!.$transaction(
            async (tx) => {
              await lockCustomerCart(tx, f.userId);
              await gate.block();
            },
            { timeout: 12_000 },
          );
          f.tasks.push(holding);
          await gate.wait();
          const other = db!.$transaction(
            async (tx) => {
              await lockCustomerCart(
                tx,
                `${f.userId}-other-synthetic-customer`,
              );
            },
            { timeout: 12_000 },
          );
          f.tasks.push(other);
          // The other transaction completes while the first still holds its lock.
          await bounded(other, "independent customer cart lock");
          gate.release();
          await holding;
        }),
      TEST_MS,
    );
  });
