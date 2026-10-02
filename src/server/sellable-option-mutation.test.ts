import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  lockOptionProduct,
  prepareOptionMutation,
} from "./sellable-option-mutation";

const mocks = {
  $queryRaw: vi.fn(),
  productVariant: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
};
const tx = mocks as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.$queryRaw.mockResolvedValue([{ id: "p" }]);
  mocks.productVariant.findMany.mockResolvedValue([]);
});

describe("transactional option mutations", () => {
  it("deactivates only explicitly selected siblings before the target write without stock changes", async () => {
    mocks.productVariant.findMany.mockResolvedValue([
      { id: "old", optionKey: "default", isActive: true },
    ]);
    expect(
      await prepareOptionMutation(tx, "p", {
        optionLabel: "Pins",
        stock: 3,
        deactivateOptionIds: ["old"],
      }),
    ).toMatchObject({ optionKey: "named:pins", stock: 3 });
    expect(mocks.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId: "p", id: { in: ["old"] } },
      data: { isActive: false },
    });
  });
  it("rejects stale/foreign transition IDs before any mutation", async () => {
    await expect(
      prepareOptionMutation(tx, "p", {
        isDefault: true,
        stock: 1,
        deactivateOptionIds: ["foreign"],
      }),
    ).rejects.toThrow("Reload");
    expect(mocks.productVariant.updateMany).not.toHaveBeenCalled();
  });
  it("locks the product row using a parameterized query", async () => {
    await lockOptionProduct(tx, "p");
    const query = mocks.$queryRaw.mock.calls[0]![0] as Prisma.Sql;
    expect(query.sql).toContain("FOR NO KEY UPDATE");
    expect(query.values).toEqual(["p"]);
  });
  it("rejects missing products", async () => {
    mocks.$queryRaw.mockResolvedValue([]);
    await expect(lockOptionProduct(tx, "missing")).rejects.toThrow("Not found");
  });
  it.each([
    [
      { isDefault: true, stock: 2 },
      [{ optionKey: "named:pins", isActive: true }],
    ],
    [
      { optionLabel: "Pins", stock: 2 },
      [{ optionKey: "default", isActive: true }],
    ],
    [{ isDefault: true, stock: 2 }, [{ optionKey: null, isActive: true }]],
  ])(
    "rejects coexistence without moving sibling stock",
    async (input, siblings) => {
      mocks.productVariant.findMany.mockResolvedValue(siblings);
      await expect(prepareOptionMutation(tx, "p", input)).rejects.toThrow(
        "Deactivate",
      );
    },
  );
  it("allows the next type after explicit deactivation, retaining new stock only", async () => {
    mocks.productVariant.findMany.mockResolvedValue([
      { optionKey: "default", isActive: false },
    ]);
    expect(
      await prepareOptionMutation(tx, "p", { optionLabel: "Pins", stock: 3 }),
    ).toMatchObject({ optionKey: "named:pins", stock: 3 });
  });
  it("keeps default/named cart identities immutable", async () => {
    mocks.productVariant.findUnique.mockResolvedValue({
      id: "v",
      productId: "p",
      optionKey: "default",
    });
    await expect(
      prepareOptionMutation(
        tx,
        "p",
        { isDefault: false, optionLabel: "Pins" },
        "v",
      ),
    ).rejects.toThrow("identity");
    mocks.productVariant.findUnique.mockResolvedValue({
      id: "v",
      productId: "p",
      optionKey: null,
    });
    await expect(
      prepareOptionMutation(tx, "p", { isDefault: true }, "v"),
    ).rejects.toThrow("legacy");
  });
  it("rejects normalized duplicates including inactive siblings", async () => {
    mocks.productVariant.findMany.mockResolvedValue([
      { optionKey: "named:pins", isActive: false },
    ]);
    await expect(
      prepareOptionMutation(tx, "p", { optionLabel: "PINS", stock: 1 }),
    ).rejects.toThrow("option key");
  });
  it("rejects foreign IDs and clearing a named label", async () => {
    mocks.productVariant.findUnique.mockResolvedValue({ productId: "other" });
    await expect(
      prepareOptionMutation(tx, "p", { stock: 1 }, "v"),
    ).rejects.toThrow("Not found");
    mocks.productVariant.findUnique.mockResolvedValue({
      productId: "p",
      optionKey: "named:pins",
      optionLabel: "Pins",
    });
    await expect(
      prepareOptionMutation(tx, "p", { optionLabel: null }, "v"),
    ).rejects.toThrow("label");
  });
});
