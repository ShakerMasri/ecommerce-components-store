import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rateLimit: vi.fn(),
  validateSameOriginRequest: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    productVariant: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("~/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("~/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("~/lib/csrf", () => ({
  validateSameOriginRequest: mocks.validateSameOriginRequest,
}));

vi.mock("~/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("~/lib/logger", () => ({
  getReferenceMessage: (message: string, errorId: string) =>
    `${message} Reference: ${errorId}`,
  logError: vi.fn(() => "err_test"),
}));

import { DELETE, PATCH } from "./route";

const productId = "clh1q2w3e000008l4a5b6c7d8";
const variantId = "clh1q2w3e000108l4a5b6c7d9";

const routeParams = {
  params: Promise.resolve({ id: productId, variantId }),
};

function createPatchRequest(body: unknown) {
  return new Request(
    `http://localhost:3000/api/admin/products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify(body),
    },
  );
}

function createDeleteRequest() {
  return new Request(
    `http://localhost:3000/api/admin/products/${productId}/variants/${variantId}`,
    {
      method: "DELETE",
      headers: {
        origin: "http://localhost:3000",
      },
    },
  );
}

function createVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: variantId,
    productId,
    sizeLabel: "M",
    colorLabel: "Black",
    optionKey: "named:m / black",
    optionLabel: "M / Black",
    stock: 5,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("admin single product variant route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    });

    mocks.prisma.$transaction.mockImplementation(
      async (run: (tx: typeof mocks.prisma) => Promise<unknown>) =>
        run(mocks.prisma),
    );
    mocks.prisma.$queryRaw.mockResolvedValue([{ id: productId }]);
    mocks.prisma.productVariant.findMany.mockResolvedValue([]);
    mocks.rateLimit.mockResolvedValue({ ok: true });
    mocks.validateSameOriginRequest.mockReturnValue(null);
    mocks.prisma.productVariant.findUnique.mockResolvedValue({
      id: variantId,
      productId,
      optionKey: "named:m / black",
      optionLabel: "M / Black",
    });
  });

  it("updates a variant owned by the route product", async () => {
    mocks.prisma.productVariant.update.mockResolvedValue(
      createVariant({ stock: 9, optionLabel: "Navy", optionKey: "named:navy" }),
    );

    const response = await PATCH(
      createPatchRequest({ optionLabel: " Navy ", stock: "9" }),
      routeParams,
    );
    const body = (await response.json()) as {
      variant: { optionLabel: string; stock: number };
    };

    expect(response.status).toBe(200);
    expect(body.variant.optionLabel).toBe("Navy");
    expect(body.variant.stock).toBe(9);
    expect(mocks.prisma.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: variantId },
        data: expect.objectContaining({
          optionLabel: "Navy",
          optionKey: "named:navy",
          stock: 9,
        }),
      }),
    );
  });

  it("rejects updates for a variant owned by another product", async () => {
    mocks.prisma.productVariant.findUnique.mockResolvedValue({
      id: variantId,
      productId: "clh1q2w3e000208l4a5b6c7e0",
      optionKey: "named:m / black",
      optionLabel: "M / Black",
    });

    const response = await PATCH(
      createPatchRequest({ optionLabel: "Navy", stock: "9" }),
      routeParams,
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(404);
    expect(body.message).toBe("Not found.");
    expect(mocks.prisma.productVariant.update).not.toHaveBeenCalled();
  });

  it("soft-deactivates a variant instead of hard-deleting it", async () => {
    mocks.prisma.productVariant.update.mockResolvedValue(
      createVariant({ isActive: false }),
    );

    const response = await DELETE(createDeleteRequest(), routeParams);
    const body = (await response.json()) as { variant: { isActive: boolean } };

    expect(response.status).toBe(200);
    expect(body.variant.isActive).toBe(false);
    expect(mocks.prisma.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: variantId },
        data: { isActive: false },
      }),
    );
  });
});
