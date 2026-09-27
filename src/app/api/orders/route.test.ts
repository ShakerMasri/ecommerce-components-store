import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
    },
    productVariant: {
      updateMany: vi.fn(),
    },
  };

  return {
    auth: vi.fn(),
    rateLimit: vi.fn(),
    validateSameOriginRequest: vi.fn(),
    getDeliveryAreaByKey: vi.fn(),
    isDeliveryAreaKey: vi.fn(),
    sendOrderNotificationEmail: vi.fn(),
    env: {
      ORDER_NOTIFICATION_EMAIL: "owner@example.com",
    },
    tx,
    prisma: {
      $transaction: vi.fn(),
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
    },
  };
});

vi.mock("~/server/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("~/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("~/lib/csrf", () => ({
  validateSameOriginRequest: mocks.validateSameOriginRequest,
}));

vi.mock("~/lib/delivery", () => ({
  getDeliveryAreaByKey: mocks.getDeliveryAreaByKey,
  isDeliveryAreaKey: mocks.isDeliveryAreaKey,
}));

vi.mock("~/env", () => ({
  env: mocks.env,
}));

vi.mock("~/server/email", () => ({
  sendOrderNotificationEmail: mocks.sendOrderNotificationEmail,
}));

vi.mock("~/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET, POST } from "./route";

function createGetRequest(path = "/api/orders") {
  return new Request(`http://localhost:3000${path}`);
}

function createRequest(body: unknown) {
  return new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

function createOrderInput() {
  return {
    phone: "+970599000000",
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    deliveryAreaKey: "west_bank_cities",
    deliveryCity: "Ramallah",
    deliveryAddress: "Main street, building 12",
    deliveryNotes: "Call before arriving",
    pickupAgreementAccepted: false,
  };
}

describe("customer order route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });

    mocks.rateLimit.mockResolvedValue({
      ok: true,
    });

    mocks.validateSameOriginRequest.mockReturnValue(null);

    mocks.getDeliveryAreaByKey.mockReturnValue({
      key: "west_bank_cities",
      priceNis: 20,
    });

    mocks.isDeliveryAreaKey.mockReturnValue(true);
    mocks.env.ORDER_NOTIFICATION_EMAIL = "owner@example.com";
    mocks.sendOrderNotificationEmail.mockResolvedValue(undefined);

    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
        return callback(mocks.tx);
      },
    );

    mocks.tx.user.findUnique.mockResolvedValue({
      name: "Test Customer",
      email: "customer@example.com",
      emailVerified: true,
      phone: "+970599000000",
    });

    mocks.tx.order.findUnique.mockResolvedValue(null);
    mocks.tx.cartItem.findMany.mockResolvedValue([
      {
        id: "cart-item-1",
        quantity: 2,
        productId: "product-1",
        productVariantId: "variant-1",
        productVariant: {
          id: "variant-1",
          productId: "product-1",
          sizeLabel: "M",
          colorLabel: "Black",
          stock: 5,
          isActive: true,
        },
        product: {
          id: "product-1",
          name: "Classic cotton t-shirt",
          slug: "classic-cotton-t-shirt",
          price: new Prisma.Decimal("50.00"),
          discountPrice: new Prisma.Decimal("40.00"),
          images: ["https://example.com/image.jpg"],
          isArchived: false,
          variants: [{ id: "variant-1" }],
        },
      },
    ]);

    mocks.tx.order.create.mockResolvedValue({
      id: "order-1",
      status: "PENDING",
      paymentMethod: "CASH_ON_DELIVERY",
      paymentStatus: "UNPAID",
      totalAmount: new Prisma.Decimal("100.00"),
      deliveryAreaKey: "west_bank_cities",
      deliveryPrice: new Prisma.Decimal("20.00"),
      deliveryCity: "Ramallah",
      deliveryAddress: "Main street, building 12",
      deliveryNotes: "Call before arriving",
      pickupAgreementAccepted: false,
      createdAt: new Date("2026-05-24T10:00:00.000Z"),
      items: [
        {
          id: "order-item-1",
          quantity: 2,
          priceAtPurchase: new Prisma.Decimal("40.00"),
          subtotalAmount: new Prisma.Decimal("80.00"),
          productNameAtPurchase: "Classic cotton t-shirt",
          productSlugAtPurchase: "classic-cotton-t-shirt",
          productImagesAtPurchase: ["https://example.com/image.jpg"],
          productVariantId: "variant-1",
          selectedSizeLabel: "M",
          selectedColorLabel: "Black",
        },
      ],
    });

    mocks.tx.product.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        status: "PENDING",
        paymentMethod: "CASH_ON_DELIVERY",
        paymentStatus: "UNPAID",
        totalAmount: new Prisma.Decimal("100.00"),
        deliveryAreaKey: "west_bank_cities",
        deliveryPrice: new Prisma.Decimal("20.00"),
        deliveryCity: "Ramallah",
        deliveryAddress: "Main street, building 12",
        deliveryNotes: "Call before arriving",
        pickupAgreementAccepted: false,
        createdAt: new Date("2026-05-24T10:00:00.000Z"),
        items: [
          {
            id: "order-item-1",
            quantity: 2,
            priceAtPurchase: new Prisma.Decimal("40.00"),
            subtotalAmount: new Prisma.Decimal("80.00"),
            productNameAtPurchase: "Classic cotton t-shirt",
            productSlugAtPurchase: "classic-cotton-t-shirt",
            productImagesAtPurchase: ["https://example.com/image.jpg"],
            productVariantId: "variant-1",
            selectedSizeLabel: "M",
            selectedColorLabel: "Black",
          },
        ],
      },
    ]);
    mocks.prisma.order.count.mockResolvedValue(1);
    mocks.prisma.order.aggregate.mockResolvedValue({
      _sum: {
        totalAmount: new Prisma.Decimal("100.00"),
      },
    });
  });

  it("loads the current customer's orders with capped pagination", async () => {
    const response = await GET(createGetRequest("/api/orders?page=2&limit=10"));
    const body = (await response.json()) as {
      orders: Array<{ id: string; totalAmount: string }>;
      pagination: {
        page: number;
        limit: number;
        hasNextPage: boolean;
        nextPage: number | null;
      };
      summary: {
        totalOrders: number;
        activeOrdersCount: number;
        totalSpent: string;
      };
    };

    expect(response.status).toBe(200);
    expect(mocks.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        skip: 10,
        take: 11,
      }),
    );
    expect(mocks.prisma.order.count).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(mocks.prisma.order.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: {
          notIn: ["DELIVERED", "CANCELLED"],
        },
      },
    });
    expect(body.orders[0]?.totalAmount).toBe("100");
    expect(body.pagination).toEqual({
      page: 2,
      limit: 10,
      hasNextPage: false,
      nextPage: null,
    });
    expect(body.summary).toEqual({
      totalOrders: 1,
      activeOrdersCount: 1,
      totalSpent: "100",
    });
  });

  it("returns next-page metadata without returning the extra lookahead order", async () => {
    const order = {
      id: "order-1",
      status: "PENDING",
      paymentMethod: "CASH_ON_DELIVERY",
      paymentStatus: "UNPAID",
      totalAmount: new Prisma.Decimal("100.00"),
      deliveryAreaKey: "west_bank_cities",
      deliveryPrice: new Prisma.Decimal("20.00"),
      deliveryCity: "Ramallah",
      deliveryAddress: "Main street, building 12",
      deliveryNotes: "Call before arriving",
      pickupAgreementAccepted: false,
      createdAt: new Date("2026-05-24T10:00:00.000Z"),
      items: [],
    };

    mocks.prisma.order.findMany.mockResolvedValue([
      { ...order, id: "order-1" },
      { ...order, id: "order-2" },
    ]);

    const response = await GET(createGetRequest("/api/orders?page=1&limit=1"));
    const body = (await response.json()) as {
      orders: Array<{ id: string }>;
      pagination: { hasNextPage: boolean; nextPage: number | null };
    };

    expect(response.status).toBe(200);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]?.id).toBe("order-1");
    expect(body.pagination.hasNextPage).toBe(true);
    expect(body.pagination.nextPage).toBe(2);
  });

  it("rejects invalid customer order pagination", async () => {
    const response = await GET(createGetRequest("/api/orders?page=0&limit=50"));
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid order query parameters.");
    expect(mocks.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it("rejects forged customer order query parameters", async () => {
    const response = await GET(
      createGetRequest("/api/orders?page=1&limit=20&userId=other-user"),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid order query parameters.");
    expect(mocks.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   ", "invalid"])(
    "rejects invalid phone %s with a field error",
    async (phone) => {
      const response = await POST(
        createRequest({ ...createOrderInput(), phone }),
      );
      const body = (await response.json()) as { errors: { phone: string[] } };

      expect(response.status).toBe(400);
      expect(body.errors.phone.length).toBeGreaterThan(0);
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([null, "+970599111111"])(
    "saves the submitted phone after creating an order when the saved phone is %s",
    async (phone) => {
      mocks.tx.user.findUnique.mockResolvedValueOnce({
        name: "Test Customer",
        email: "customer@example.com",
        emailVerified: true,
        phone,
      });
      const response = await POST(
        createRequest({ ...createOrderInput(), phone: "+970 599-000000" }),
      );

      expect(response.status).toBe(200);
      expect(mocks.tx.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { phone: "+970599000000" },
      });
      expect(mocks.tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerPhoneAtPurchase: "+970599000000",
          }),
        }),
      );
      expect(mocks.sendOrderNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          customerPhone: "+970599000000",
        }),
      );
      expect(mocks.tx.order.create.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.tx.user.update.mock.invocationCallOrder[0]!,
      );
    },
  );

  it("does not save a changed phone when order creation fails", async () => {
    mocks.tx.order.create.mockRejectedValueOnce(
      new Error("INSUFFICIENT_STOCK"),
    );
    const response = await POST(
      createRequest({ ...createOrderInput(), phone: "+970599222222" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });

  it("creates a pending order and reserves selected option stock", async () => {
    const response = await POST(createRequest(createOrderInput()));
    const body = (await response.json()) as {
      message: string;
      order: {
        status: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.order.status).toBe("PENDING");
    expect(body.message).toContain("confirm it by WhatsApp or phone");
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: {
        id: "variant-1",
        productId: "product-1",
        isActive: true,
        stock: {
          gte: 2,
        },
      },
      data: {
        stock: {
          decrement: 2,
        },
      },
    });
    expect(mocks.tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryAreaKey: "west_bank_cities",
          stockDeductedAt: expect.any(Date),
          items: expect.objectContaining({
            create: [
              expect.objectContaining({
                productId: "product-1",
                productVariantId: "variant-1",
                quantity: 2,
                priceAtPurchase: new Prisma.Decimal("40.00"),
                subtotalAmount: new Prisma.Decimal("80.00"),
                selectedSizeLabel: "M",
                selectedColorLabel: "Black",
              }),
            ],
          }),
        }),
      }),
    );

    const createPayload = mocks.tx.order.create.mock.calls[0]?.[0];

    expect(createPayload?.data.deliveryPrice.toString()).toBe("20");
    expect(createPayload?.data.totalAmount.toString()).toBe("100");
    expect(mocks.sendOrderNotificationEmail).toHaveBeenCalledWith({
      orderId: "order-1",
      totalAmount: "100",
      deliveryAreaKey: "west_bank_cities",
      deliveryCity: "Ramallah",
      customerName: "Test Customer",
      customerPhone: "+970599000000",
      itemCount: 2,
      createdAt: new Date("2026-05-24T10:00:00.000Z"),
    });
  });

  it("snapshots selected variant details for variant cart items", async () => {
    mocks.tx.cartItem.findMany.mockResolvedValue([
      {
        id: "cart-item-1",
        quantity: 2,
        productId: "product-1",
        productVariantId: "variant-1",
        productVariant: {
          id: "variant-1",
          productId: "product-1",
          sizeLabel: "M",
          colorLabel: "Black",
          stock: 5,
          isActive: true,
        },
        product: {
          id: "product-1",
          name: "Classic cotton t-shirt",
          slug: "classic-cotton-t-shirt",
          price: new Prisma.Decimal("50.00"),
          discountPrice: new Prisma.Decimal("40.00"),
          images: ["https://example.com/image.jpg"],
          isArchived: false,
          variants: [{ id: "variant-1" }],
        },
      },
    ]);

    const response = await POST(createRequest(createOrderInput()));

    expect(response.status).toBe(200);
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: {
        id: "variant-1",
        productId: "product-1",
        isActive: true,
        stock: {
          gte: 2,
        },
      },
      data: {
        stock: {
          decrement: 2,
        },
      },
    });
    expect(mocks.tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: expect.objectContaining({
            create: [
              expect.objectContaining({
                productId: "product-1",
                productVariantId: "variant-1",
                selectedSizeLabel: "M",
                selectedColorLabel: "Black",
              }),
            ],
          }),
        }),
      }),
    );
  });

  it("requires a selected option for checkout inventory", async () => {
    mocks.tx.cartItem.findMany.mockResolvedValue([
      {
        id: "cart-item-1",
        quantity: 1,
        productId: "product-1",
        productVariantId: null,
        productVariant: null,
        product: {
          id: "product-1",
          name: "Classic cotton t-shirt",
          slug: "classic-cotton-t-shirt",
          price: new Prisma.Decimal("50.00"),
          discountPrice: null,
          images: [],
          isArchived: false,
          variants: [{ id: "variant-1" }],
        },
      },
    ]);

    const response = await POST(createRequest(createOrderInput()));
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toContain("selected size or color");
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });

  it("does not create an order when variant reservation fails", async () => {
    mocks.tx.cartItem.findMany.mockResolvedValue([
      {
        id: "cart-item-1",
        quantity: 2,
        productId: "product-1",
        productVariantId: "variant-1",
        productVariant: {
          id: "variant-1",
          productId: "product-1",
          sizeLabel: "M",
          colorLabel: "Black",
          stock: 1,
          isActive: true,
        },
        product: {
          id: "product-1",
          name: "Classic cotton t-shirt",
          slug: "classic-cotton-t-shirt",
          price: new Prisma.Decimal("50.00"),
          discountPrice: null,
          images: [],
          isArchived: false,
          variants: [{ id: "variant-1" }],
        },
      },
    ]);
    mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(createRequest(createOrderInput()));
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toContain("do not have enough stock");
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it("does not fail checkout when owner notification email fails", async () => {
    mocks.sendOrderNotificationEmail.mockRejectedValueOnce(
      new Error("SMTP temporarily unavailable"),
    );

    const response = await POST(createRequest(createOrderInput()));
    const body = (await response.json()) as {
      order: { id?: string; status: string };
    };

    expect(response.status).toBe(200);
    expect(body.order.status).toBe("PENDING");
    expect(mocks.sendOrderNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it("skips owner notification when no notification recipient is configured", async () => {
    Reflect.deleteProperty(mocks.env, "ORDER_NOTIFICATION_EMAIL");

    const response = await POST(createRequest(createOrderInput()));

    expect(response.status).toBe(200);
    expect(mocks.sendOrderNotificationEmail).not.toHaveBeenCalled();
  });

  it("does not send an owner notification for an idempotent existing order response", async () => {
    mocks.tx.order.findUnique.mockResolvedValueOnce({
      id: "order-1",
      status: "PENDING",
      paymentMethod: "CASH_ON_DELIVERY",
      paymentStatus: "UNPAID",
      totalAmount: new Prisma.Decimal("100.00"),
      deliveryAreaKey: "west_bank_cities",
      deliveryPrice: new Prisma.Decimal("20.00"),
      deliveryCity: "Ramallah",
      deliveryAddress: "Main street, building 12",
      deliveryNotes: "Call before arriving",
      pickupAgreementAccepted: false,
      createdAt: new Date("2026-05-24T10:00:00.000Z"),
      items: [],
    });

    const response = await POST(createRequest(createOrderInput()));

    expect(response.status).toBe(200);
    expect(mocks.tx.cartItem.findMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
    expect(mocks.sendOrderNotificationEmail).not.toHaveBeenCalled();
  });

  it("rejects client-supplied delivery prices", async () => {
    const response = await POST(
      createRequest({
        ...createOrderInput(),
        deliveryPrice: 0,
      }),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid order request.");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });
});
