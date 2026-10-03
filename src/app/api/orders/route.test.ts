import { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import net from "node:net";
import SMTPConnection from "nodemailer/lib/smtp-connection";
import { Readable } from "node:stream";
import type * as EmailModule from "~/server/email";
import { setImmediate as realImmediate } from "node:timers";
import { CHECKOUT_EMAIL_BUDGET_MS } from "~/server/checkout-email";
import * as receiptTemplate from "~/server/order-receipt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as RateLimitModule from "~/lib/rate-limit";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
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
    redisLimit: vi.fn(),
    validateSameOriginRequest: vi.fn(),
    getDeliveryAreaByKey: vi.fn(),
    isDeliveryAreaKey: vi.fn(),
    sendOrderNotificationEmail: vi.fn(),
    sendCustomerOrderReceiptEmail: vi.fn(),
    env: {
      NODE_ENV: "test",
      UPSTASH_REDIS_REST_URL: "https://example-upstash.com",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
      ORDER_NOTIFICATION_EMAIL: "owner@example.com",
      EMAIL_DELIVERY_MODE: "smtp",
      SMTP_HOST: "smtp.example.invalid",
      SMTP_PORT: 587,
      SMTP_USER: "fixture",
      SMTP_PASSWORD: "fixture",
      SMTP_FROM_EMAIL: "support@darakit.com",
      SMTP_FROM_NAME: "DaraKit",
      APP_URL: "https://darakit.example.invalid",
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

vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = mocks.redisLimit;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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
  sendCustomerOrderReceiptEmail: mocks.sendCustomerOrderReceiptEmail,
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
  it.each(["denied", "error", "timeout"] as const)(
    "stops checkout side effects when limiter returns %s",
    async (outcome) => {
      const actual =
        await vi.importActual<typeof RateLimitModule>("~/lib/rate-limit");
      mocks.rateLimit.mockImplementation(actual.rateLimit);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      if (outcome === "error")
        mocks.redisLimit.mockRejectedValueOnce(new Error("offline"));
      else
        mocks.redisLimit.mockResolvedValueOnce({
          success: outcome === "timeout",
          reason: outcome === "timeout" ? "timeout" : undefined,
          limit: 5,
          remaining: 0,
          reset: Date.now() + 10_000,
        });
      const response = await POST(createRequest(createOrderInput()));
      expect(response.status).toBe(outcome === "denied" ? 429 : 503);
      expect(mocks.redisLimit).toHaveBeenCalledWith("user:user-1");
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
      expect(mocks.tx.order.create).not.toHaveBeenCalled();
      expect(mocks.tx.user.update).not.toHaveBeenCalled();
      expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
      expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
      expect(mocks.tx.cartItem.deleteMany).not.toHaveBeenCalled();
      expect(mocks.sendOrderNotificationEmail).not.toHaveBeenCalled();
      expect(mocks.sendCustomerOrderReceiptEmail).not.toHaveBeenCalled();
    },
  );

  it("identifies an unverified email without creating an order or changing stock", async () => {
    mocks.tx.user.findUnique.mockResolvedValueOnce({
      emailVerified: false,
    });

    const response = await POST(createRequest(createOrderInput()));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email before placing an order.",
    });
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.sendCustomerOrderReceiptEmail).not.toHaveBeenCalled();
  });

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
    mocks.sendCustomerOrderReceiptEmail.mockResolvedValue(undefined);

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
          optionKey: "named:m / black",
          optionLabel: "M / Black",
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

  it.each([
    undefined,
    "",
    "   ",
    "invalid",
    "----------",
    "\\----------",
    "1---------",
    "+---------",
    "++970599000000",
    "059900000",
    "+970502345678",
    "+971502345678",
    "0554461234",
    "0599/000000",
    "00970 (59) 912 - 3456".padEnd(41, " "),
  ])("rejects invalid phone %s with a field error", async (phone) => {
    const response = await POST(
      createRequest({ ...createOrderInput(), phone }),
    );
    const body = (await response.json()) as { errors: { phone: string[] } };

    expect(response.status).toBe(400);
    expect(body.errors.phone.length).toBeGreaterThan(0);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
    expect(mocks.sendOrderNotificationEmail).not.toHaveBeenCalled();
  });

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
        expect.anything(),
      );
      expect(mocks.tx.order.create.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.tx.user.update.mock.invocationCallOrder[0]!,
      );
    },
  );

  it.each([
    ["(059) 922-2222", "0599222222"],
    ["00970 (56) 812-3456", "+970568123456"],
    ["00970 (59) 912 - 3456", "+970599123456"],
    ["00972 (51) 612-3456", "+972516123456"],
  ])(
    "snapshots and saves normalized phone %s in the transaction",
    async (input, normalized) => {
      const response = await POST(
        createRequest({ ...createOrderInput(), phone: input }),
      );
      expect(response.status).toBe(200);
      expect(mocks.tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerPhoneAtPurchase: normalized,
          }),
        }),
      );
      expect(mocks.tx.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { phone: normalized },
      });
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
    expect(mocks.sendCustomerOrderReceiptEmail).not.toHaveBeenCalled();
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
        optionKey: "named:m / black",
        optionLabel: "M / Black",
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
    expect(mocks.sendOrderNotificationEmail).toHaveBeenCalledWith(
      {
        orderId: "order-1",
        totalAmount: "100",
        deliveryAreaKey: "west_bank_cities",
        deliveryCity: "Ramallah",
        customerName: "Test Customer",
        customerPhone: "+970599000000",
        itemCount: 2,
        createdAt: new Date("2026-05-24T10:00:00.000Z"),
      },
      expect.anything(),
    );
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
          optionKey: "named:m / black",
          optionLabel: "M / Black",
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
        optionKey: "named:m / black",
        optionLabel: "M / Black",
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
    expect(body.message).toContain("selected option");
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
          optionKey: "named:m / black",
          optionLabel: "M / Black",
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
    expect(mocks.sendCustomerOrderReceiptEmail).toHaveBeenCalledTimes(1);
  });

  it("awaits the receipt for the verified database email after commit, using only persisted order data", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "user-1", email: "stale@example.com" },
    });
    const persisted = await mocks.tx.order.create();
    persisted.items[0].productNameAtPurchase = "لوحة تجريبية";
    persisted.items[0].selectedOptionLabel = "5 فولت";
    persisted.totalAmount = new Prisma.Decimal("91.25");
    mocks.tx.order.create.mockResolvedValue(persisted);
    let committed = false;
    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      const result = await callback(mocks.tx);
      expect(mocks.sendCustomerOrderReceiptEmail).not.toHaveBeenCalled();
      committed = true;
      return result;
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const receiptStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    mocks.sendCustomerOrderReceiptEmail.mockImplementationOnce(async () => {
      expect(committed).toBe(true);
      started();
      await pending;
    });
    let finished = false;
    const checkout = POST(createRequest(createOrderInput())).then(
      (response) => {
        finished = true;
        return response;
      },
    );
    await receiptStarted;
    expect(finished).toBe(false);
    expect(mocks.sendCustomerOrderReceiptEmail).toHaveBeenCalledWith(
      {
        to: "customer@example.com",
        order: persisted,
      },
      expect.anything(),
    );
    release();
    expect((await checkout).status).toBe(200);
  });

  it.each([false, true])(
    "keeps checkout and owner delivery independent when receipt fails (owner failure: %s)",
    async (ownerFails) => {
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      mocks.sendCustomerOrderReceiptEmail.mockRejectedValueOnce(
        new Error("private SMTP body"),
      );
      if (ownerFails)
        mocks.sendOrderNotificationEmail.mockRejectedValueOnce(
          new Error("Email delivery failed."),
        );
      const response = await POST(createRequest(createOrderInput()));
      expect(response.status).toBe(200);
      expect((await response.json()).order).toMatchObject({
        id: "order-1",
        status: "PENDING",
        totalAmount: "100",
      });
      expect(mocks.tx.order.create).toHaveBeenCalledTimes(1);
      expect(mocks.tx.cartItem.deleteMany).toHaveBeenCalledTimes(1);
      expect(mocks.sendOrderNotificationEmail).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(log.mock.calls)).not.toContain("private SMTP body");
    },
  );

  it.each(["customer", "owner", "both"])(
    "bounds checkout when %s transport stalls and cleans only owned resources",
    async (stalled) => {
      vi.useFakeTimers();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const actual =
        await vi.importActual<typeof EmailModule>("~/server/email");
      mocks.sendCustomerOrderReceiptEmail.mockImplementation(
        actual.sendCustomerOrderReceiptEmail,
      );
      mocks.sendOrderNotificationEmail.mockImplementation(
        actual.sendOrderNotificationEmail,
      );
      const sockets: net.Socket[] = [];
      const unrelated = new net.Socket();
      vi.spyOn(net, "createConnection").mockImplementation(() => {
        const socket = new net.Socket();
        sockets.push(socket);
        queueMicrotask(() => socket.emit("connect"));
        return socket;
      });
      const connections: SMTPConnection[] = [];
      const streams: Readable[] = [];
      const close = vi.spyOn(SMTPConnection.prototype, "close");
      const rejectLate: ((error: Error) => void)[] = [];
      let ready!: () => void;
      const started = new Promise<void>((resolve) => {
        ready = resolve;
      });
      vi.spyOn(SMTPConnection.prototype, "connect").mockImplementation(
        function (this: SMTPConnection, callback) {
          connections.push(this);
          expect(this.options).toMatchObject({
            connectionTimeout: 2000,
            greetingTimeout: 2000,
            socketTimeout: 3000,
            secure: false,
          });
          callback?.();
        },
      );
      vi.spyOn(SMTPConnection.prototype, "send").mockImplementation(
        (_envelope, message, callback) => {
          const index = streams.length;
          expect(message).toBeInstanceOf(Readable);
          streams.push(message as Readable);
          if (
            stalled === "both" ||
            (index === 0 ? stalled === "customer" : stalled === "owner")
          ) {
            rejectLate.push((error) =>
              callback(error, {
                accepted: [],
                rejected: [],
                ehlo: [],
                envelopeTime: 0,
                messageTime: 0,
                messageSize: 0,
                response: "",
              }),
            );
          } else {
            callback(null, {
              accepted: ["fixture@example.invalid"],
              rejected: [],
              ehlo: [],
              envelopeTime: 0,
              messageTime: 0,
              messageSize: 0,
              response: "250 queued",
            });
          }
          if (streams.length === 2) ready();
        },
      );
      const lateErrors: unknown[] = [];
      const onUnhandled = (error: unknown) => lateErrors.push(error);
      process.on("unhandledRejection", onUnhandled);
      try {
        let finished = false;
        const checkout = POST(createRequest(createOrderInput())).then(
          (response) => {
            finished = true;
            return response;
          },
        );
        await started;
        expect(mocks.tx.cartItem.deleteMany).toHaveBeenCalledTimes(1);
        expect(mocks.sendOrderNotificationEmail).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(CHECKOUT_EMAIL_BUDGET_MS - 1);
        expect(finished).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        const response = await checkout;
        expect(response.status).toBe(200);
        expect((await response.json()).order.id).toBe("order-1");
        expect(mocks.tx.order.create).toHaveBeenCalledTimes(1);
        for (const socket of sockets) expect(socket.destroyed).toBe(true);
        expect(close).toHaveBeenCalledTimes(2);
        for (const connection of connections)
          expect(connection.destroyed).toBe(true);
        for (const stream of streams) expect(stream.destroyed).toBe(true);
        expect(unrelated.destroyed).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
        rejectLate.forEach((reject) =>
          reject(new Error("late private provider failure")),
        );
        await new Promise<void>((resolve) => realImmediate(resolve));
        expect(lateErrors).toEqual([]);
      } finally {
        process.removeListener("unhandledRejection", onUnhandled);
        unrelated.destroy();
        sockets.forEach((socket) => socket.destroy());
      }
    },
  );

  it.each(["template", "attachment"])(
    "keeps checkout successful after %s preparation fails",
    async (stage) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const actual =
        await vi.importActual<typeof EmailModule>("~/server/email");
      mocks.sendCustomerOrderReceiptEmail.mockImplementation(
        actual.sendCustomerOrderReceiptEmail,
      );
      const realBuild = receiptTemplate.buildOrderReceipt;
      vi.spyOn(receiptTemplate, "buildOrderReceipt").mockImplementationOnce(
        (order) => {
          if (stage === "template")
            throw new Error("template preparation failed");
          const mail = realBuild(order);
          Object.defineProperty(mail, "attachments", {
            enumerable: true,
            get: () => {
              throw new Error("attachment preparation failed");
            },
          });
          return mail;
        },
      );
      const create = vi.spyOn(nodemailer, "createTransport");
      const response = await POST(createRequest(createOrderInput()));
      expect(response.status).toBe(200);
      expect((await response.json()).order.id).toBe("order-1");
      expect(mocks.tx.cartItem.deleteMany).toHaveBeenCalledTimes(1);
      expect(mocks.sendOrderNotificationEmail).toHaveBeenCalledTimes(1);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each([
    "EMPTY_CART",
    "INSUFFICIENT_STOCK",
    "EMAIL_NOT_VERIFIED",
    "commit failed",
  ])("does not email when checkout fails: %s", async (reason) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.prisma.$transaction.mockRejectedValueOnce(new Error(reason));
    expect((await POST(createRequest(createOrderInput()))).status).not.toBe(
      200,
    );
    expect(mocks.sendCustomerOrderReceiptEmail).not.toHaveBeenCalled();
    expect(mocks.sendOrderNotificationEmail).not.toHaveBeenCalled();
  });

  it("does not email a unique-key race fallback", async () => {
    const persisted = await mocks.tx.order.create();
    mocks.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.6.0",
      }),
    );
    mocks.prisma.order.findUnique.mockResolvedValueOnce(persisted);
    expect((await POST(createRequest(createOrderInput()))).status).toBe(200);
    expect(mocks.sendCustomerOrderReceiptEmail).not.toHaveBeenCalled();
    expect(mocks.sendOrderNotificationEmail).not.toHaveBeenCalled();
  });

  it("skips owner notification when no notification recipient is configured", async () => {
    Reflect.deleteProperty(mocks.env, "ORDER_NOTIFICATION_EMAIL");

    const response = await POST(createRequest(createOrderInput()));

    expect(response.status).toBe(200);
    expect(mocks.sendOrderNotificationEmail).not.toHaveBeenCalled();
    expect(mocks.sendCustomerOrderReceiptEmail).toHaveBeenCalledTimes(1);
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
    expect(mocks.sendCustomerOrderReceiptEmail).not.toHaveBeenCalled();
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
  it("purchases a default without artificial labels and retries without a second deduction", async () => {
    const items = await mocks.tx.cartItem.findMany();
    items[0].productVariant = {
      ...items[0].productVariant,
      optionKey: "default",
      optionLabel: null,
      sizeLabel: null,
      colorLabel: null,
    };
    mocks.tx.cartItem.findMany.mockResolvedValue(items);
    const first = await POST(createRequest(createOrderInput()));
    expect(first.status).toBe(200);
    expect(
      mocks.tx.order.create.mock.calls[0]![0].data.items.create[0],
    ).toMatchObject({
      productVariantId: "variant-1",
      selectedOptionLabel: null,
      selectedSizeLabel: null,
      selectedColorLabel: null,
      priceAtPurchase: new Prisma.Decimal("40.00"),
    });
    mocks.tx.order.findUnique.mockResolvedValue(await mocks.tx.order.create());
    mocks.tx.productVariant.updateMany.mockClear();
    mocks.tx.order.create.mockClear();
    expect((await POST(createRequest(createOrderInput()))).status).toBe(200);
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.sendCustomerOrderReceiptEmail).toHaveBeenCalledTimes(1);
  });
  it("snapshots a neutral label without trusting browser price or labels", async () => {
    const items = await mocks.tx.cartItem.findMany();
    items[0].productVariant = {
      ...items[0].productVariant,
      optionKey: "named:straight pins",
      optionLabel: "Straight pins",
    };
    mocks.tx.cartItem.findMany.mockResolvedValue(items);
    expect(
      (
        await POST(
          createRequest({
            ...createOrderInput(),
            price: 0,
            optionLabel: "Fake",
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect((await POST(createRequest(createOrderInput()))).status).toBe(200);
    expect(
      mocks.tx.order.create.mock.calls[0]![0].data.items.create[0],
    ).toMatchObject({
      selectedOptionLabel: "Straight pins",
      productNameAtPurchase: items[0].product.name,
      priceAtPurchase: new Prisma.Decimal("40.00"),
    });
  });
  it.each(["unmapped", "inactive", "foreign", "deleted"])(
    "rejects %s cart options before stock writes",
    async (kind) => {
      const items = await mocks.tx.cartItem.findMany();
      const option = { ...items[0].productVariant };
      if (kind === "unmapped") {
        option.optionKey = null;
        option.optionLabel = null;
      }
      if (kind === "inactive") option.isActive = false;
      if (kind === "foreign") option.productId = "other";
      items[0].productVariant = kind === "deleted" ? null : option;
      mocks.tx.cartItem.findMany.mockResolvedValue(items);
      expect((await POST(createRequest(createOrderInput()))).status).toBe(400);
      expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
      expect(mocks.tx.order.create).not.toHaveBeenCalled();
    },
  );
});
