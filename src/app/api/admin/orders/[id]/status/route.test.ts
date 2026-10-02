import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const validOrderId = "clh1q2w3e000008l4a5b6c7d8";

const mocks = vi.hoisted(() => {
  const tx = {
    order: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
    },
    productVariant: {
      updateMany: vi.fn(),
    },
  };

  return {
    requireAdmin: vi.fn(),
    rateLimit: vi.fn(),
    validateSameOriginRequest: vi.fn(),
    tx,
    prisma: {
      $transaction: vi.fn(),
    },
  };
});

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

import { PATCH } from "./route";

function createRequest(status: OrderStatus) {
  return new Request(
    `http://localhost:3000/api/admin/orders/${validOrderId}/status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ status }),
    },
  );
}

function createRouteContext() {
  return {
    params: Promise.resolve({ id: validOrderId }),
  };
}

function createSavedOrder(status: OrderStatus) {
  return {
    id: validOrderId,
    status,
    totalAmount: new Prisma.Decimal("120.00"),
    paymentMethod: "CASH_ON_DELIVERY",
    paymentStatus: PaymentStatus.UNPAID,
    adminNote: null,
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
  };
}

describe("admin order status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    });

    mocks.rateLimit.mockResolvedValue({
      ok: true,
    });

    mocks.validateSameOriginRequest.mockReturnValue(null);

    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
        return callback(mocks.tx);
      },
    );

    mocks.tx.product.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.order.updateMany.mockResolvedValue({ count: 1 });
  });

  it("confirms a reserved pending order without deducting stock again", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PENDING,
      stockDeductedAt: new Date("2026-05-24T09:00:00.000Z"),
      items: [
        {
          productId: "product-1",
          productVariantId: null,
          quantity: 2,
        },
      ],
    });

    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(
      createSavedOrder(OrderStatus.PROCESSING),
    );

    const response = await PATCH(
      createRequest(OrderStatus.PROCESSING),
      createRouteContext(),
    );
    const body = (await response.json()) as { order: { status: OrderStatus } };

    expect(response.status).toBe(200);
    expect(body.order.status).toBe(OrderStatus.PROCESSING);
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: validOrderId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.PROCESSING,
      },
    });
  });

  it("confirms a reserved variant order without deducting variant stock again", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PENDING,
      stockDeductedAt: new Date("2026-05-24T09:00:00.000Z"),
      items: [
        {
          productId: "product-1",
          productVariantId: "variant-1",
          quantity: 2,
        },
      ],
    });

    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(
      createSavedOrder(OrderStatus.PROCESSING),
    );

    const response = await PATCH(
      createRequest(OrderStatus.PROCESSING),
      createRouteContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: validOrderId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.PROCESSING,
      },
    });
  });

  it("does not deduct stock for any pending order during admin confirmation", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PENDING,
      stockDeductedAt: new Date("2026-05-20T10:00:00.000Z"),
      items: [
        {
          productId: "product-1",
          productVariantId: null,
          quantity: 2,
        },
      ],
    });

    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(
      createSavedOrder(OrderStatus.PROCESSING),
    );

    const response = await PATCH(
      createRequest(OrderStatus.PROCESSING),
      createRouteContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: validOrderId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.PROCESSING,
      },
    });
  });

  it("blocks confirming an older pending order that did not reserve stock", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PENDING,
      stockDeductedAt: null,
      items: [
        {
          productId: "product-1",
          productVariantId: null,
          quantity: 2,
        },
      ],
    });

    const response = await PATCH(
      createRequest(OrderStatus.PROCESSING),
      createRouteContext(),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(409);
    expect(body.message).toContain("created before checkout stock reservation");
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("fails safely when another request already changed the order status", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PENDING,
      stockDeductedAt: new Date("2026-05-24T09:00:00.000Z"),
      items: [
        {
          productId: "product-1",
          productVariantId: null,
          quantity: 3,
        },
      ],
    });

    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 });

    const response = await PATCH(
      createRequest(OrderStatus.PROCESSING),
      createRouteContext(),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(409);
    expect(body.message).toContain("updated by another request");
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("does not restock when cancelling an older unreserved pending order", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PENDING,
      stockDeductedAt: null,
      items: [
        {
          productId: "product-1",
          productVariantId: null,
          quantity: 1,
        },
      ],
    });

    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(
      createSavedOrder(OrderStatus.CANCELLED),
    );

    const response = await PATCH(
      createRequest(OrderStatus.CANCELLED),
      createRouteContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: validOrderId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });
  });

  it("restocks simple product inventory when cancelling a reserved order", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PROCESSING,
      stockDeductedAt: new Date("2026-05-24T10:00:00.000Z"),
      items: [
        {
          productId: "product-1",
          productVariantId: null,
          quantity: 1,
        },
      ],
    });

    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(
      createSavedOrder(OrderStatus.CANCELLED),
    );

    const response = await PATCH(
      createRequest(OrderStatus.CANCELLED),
      createRouteContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.tx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: "product-1",
      },
      data: {
        stock: {
          increment: 1,
        },
      },
    });
    expect(mocks.tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: validOrderId,
        status: OrderStatus.PROCESSING,
      },
      data: {
        status: OrderStatus.CANCELLED,
        stockDeductedAt: null,
      },
    });
  });

  it("restocks variant inventory when cancelling a reserved variant order", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: validOrderId,
      status: OrderStatus.PROCESSING,
      stockDeductedAt: new Date("2026-05-24T10:00:00.000Z"),
      items: [
        {
          productId: "product-1",
          productVariantId: "variant-1",
          quantity: 1,
        },
      ],
    });

    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(
      createSavedOrder(OrderStatus.CANCELLED),
    );

    const response = await PATCH(
      createRequest(OrderStatus.CANCELLED),
      createRouteContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: {
        id: "variant-1",
      },
      data: {
        stock: {
          increment: 1,
        },
      },
    });
  });
  it.each(["default-id", "named-id"])(
    "restocks %s once across repeated cancellations, including compatibility rollback",
    async (productVariantId) => {
      const reserved = {
        id: validOrderId,
        status: OrderStatus.PENDING,
        stockDeductedAt: new Date(),
        items: [{ productId: "p", productVariantId, quantity: 2 }],
      };
      mocks.tx.order.findUnique.mockResolvedValue(reserved);
      mocks.tx.order.findUniqueOrThrow.mockResolvedValue(
        createSavedOrder(OrderStatus.CANCELLED),
      );
      expect(
        (
          await PATCH(
            createRequest(OrderStatus.CANCELLED),
            createRouteContext(),
          )
        ).status,
      ).toBe(200);
      mocks.tx.order.findUnique.mockResolvedValue({
        ...reserved,
        status: OrderStatus.CANCELLED,
        stockDeductedAt: null,
      });
      expect(
        (
          await PATCH(
            createRequest(OrderStatus.CANCELLED),
            createRouteContext(),
          )
        ).status,
      ).toBe(200);
      expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledTimes(1);
      expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({
        where: { id: productVariantId },
        data: { stock: { increment: 2 } },
      });
      expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    },
  );
});
