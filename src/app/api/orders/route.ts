import { isMappedOption } from "~/lib/sellable-options";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { validateSameOriginRequest } from "~/lib/csrf";
import { getDeliveryAreaByKey } from "~/lib/delivery";
import { prisma } from "~/lib/prisma";
import { getReferenceMessage, logError } from "~/lib/logger";
import { rateLimit } from "~/lib/rate-limit";
import {
  sendCustomerOrderReceiptEmail,
  sendOrderNotificationEmail,
  type SendOrderNotificationEmailInput,
} from "~/server/email";
import { auth } from "~/server/auth";
import { getEffectiveProductPrice } from "~/server/pricing";
import { lockCustomerCart } from "~/server/cart-lock";
import {
  runCheckoutEmailWork,
  type EmailDeliveryBudget,
} from "~/server/checkout-email";
import {
  createOrderSchema,
  customerOrdersQuerySchema,
} from "~/server/validations/order";

const orderSelect = {
  id: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  totalAmount: true,
  deliveryAreaKey: true,
  deliveryPrice: true,
  deliveryCity: true,
  deliveryAddress: true,
  deliveryNotes: true,
  pickupAgreementAccepted: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      priceAtPurchase: true,
      subtotalAmount: true,
      productNameAtPurchase: true,
      productSlugAtPurchase: true,
      productImagesAtPurchase: true,
      productVariantId: true,
      selectedOptionLabel: true,
      selectedSizeLabel: true,
      selectedColorLabel: true,
    },
  },
} satisfies Prisma.OrderSelect;

type OrderWithItems = Prisma.OrderGetPayload<{
  select: typeof orderSelect;
}>;

type CreatedOrderNotification = SendOrderNotificationEmailInput;

function serializeOrder(order: OrderWithItems) {
  return {
    ...order,
    totalAmount: order.totalAmount.toString(),
    deliveryPrice: order.deliveryPrice.toString(),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      ...item,
      priceAtPurchase: item.priceAtPurchase.toString(),
      subtotalAmount: item.subtotalAmount.toString(),
    })),
  };
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "You must be logged in to view your orders." },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);

  const parsedQuery = customerOrdersQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );

  if (!parsedQuery.success) {
    return NextResponse.json(
      { message: "Invalid order query parameters." },
      { status: 400 },
    );
  }

  const { page, limit } = parsedQuery.data;
  const skip = (page - 1) * limit;

  try {
    const [ordersPlusOne, totalOrders, activeOrdersCount, totalSpent] =
      await Promise.all([
        prisma.order.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit + 1,
          select: orderSelect,
        }),
        prisma.order.count({
          where: {
            userId,
          },
        }),
        prisma.order.count({
          where: {
            userId,
            status: {
              notIn: ["DELIVERED", "CANCELLED"],
            },
          },
        }),
        prisma.order.aggregate({
          where: {
            userId,
            status: {
              not: "CANCELLED",
            },
          },
          _sum: {
            totalAmount: true,
          },
        }),
      ]);

    const hasNextPage = ordersPlusOne.length > limit;
    const orders = hasNextPage ? ordersPlusOne.slice(0, limit) : ordersPlusOne;
    const totalSpentAmount =
      totalSpent._sum.totalAmount ?? new Prisma.Decimal(0);

    return NextResponse.json({
      orders: orders.map(serializeOrder),
      pagination: {
        page,
        limit,
        hasNextPage,
        nextPage: hasNextPage ? page + 1 : null,
      },
      summary: {
        totalOrders,
        activeOrdersCount,
        totalSpent: totalSpentAmount.toString(),
      },
    });
  } catch (error) {
    const errorId = logError("Failed to load customer orders.", error, {
      action: "orders.list",
      route: "/api/orders",
      userId,
    });

    return NextResponse.json(
      { message: getReferenceMessage("Failed to load orders.", errorId) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "You must be logged in to place an order." },
      { status: 401 },
    );
  }

  const csrfResponse = validateSameOriginRequest(request);

  if (csrfResponse) {
    return csrfResponse;
  }

  const userId = session.user.id;

  const limited = await rateLimit(request, "orderCreate", userId);

  if (!limited.ok) {
    return limited.response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid order request.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const {
    idempotencyKey,
    phone,
    deliveryAreaKey,
    deliveryCity,
    deliveryAddress,
    deliveryNotes,
    pickupAgreementAccepted,
  } = parsed.data;

  const deliveryArea = getDeliveryAreaByKey(deliveryAreaKey);

  if (!deliveryArea) {
    return NextResponse.json(
      { message: "Please select a valid delivery area." },
      { status: 400 },
    );
  }

  try {
    const orderResult = await prisma.$transaction(async (tx) => {
      // Wait before reading customer/cart state or checking the retry key: a
      // preceding checkout may have committed while this request was waiting.
      await lockCustomerCart(tx, userId);
      const customer = await tx.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          name: true,
          email: true,
          emailVerified: true,
          phone: true,
        },
      });

      if (!customer) {
        throw new Error("USER_NOT_FOUND");
      }

      if (!customer.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }

      const existingOrder = await tx.order.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
        select: orderSelect,
      });

      if (existingOrder) {
        return {
          order: existingOrder,
          receiptRecipient: null,
          notification: null satisfies CreatedOrderNotification | null,
        };
      }

      const cartItems = await tx.cartItem.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          quantity: true,
          productId: true,
          productVariantId: true,
          productVariant: {
            select: {
              id: true,
              productId: true,
              optionLabel: true,
              optionKey: true,
              sizeLabel: true,
              colorLabel: true,
              stock: true,
              isActive: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              discountPrice: true,
              images: true,
              isArchived: true,
              variants: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (cartItems.length === 0) {
        throw new Error("EMPTY_CART");
      }

      for (const item of cartItems) {
        if (item.product.isArchived) {
          throw new Error("PRODUCT_NOT_AVAILABLE");
        }

        if (!item.productVariantId) {
          throw new Error("VARIANT_REQUIRED");
        }

        if (
          !item.productVariant?.isActive ||
          !isMappedOption(item.productVariant) ||
          item.productVariant.productId !== item.product.id
        ) {
          throw new Error("VARIANT_NOT_AVAILABLE");
        }

        const updateVariantResult = await tx.productVariant.updateMany({
          where: {
            id: item.productVariant.id,
            productId: item.product.id,
            isActive: true,
            optionKey: item.productVariant.optionKey,
            optionLabel: item.productVariant.optionLabel,
            stock: {
              gte: item.quantity,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (updateVariantResult.count !== 1) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const productsTotalAmount = cartItems.reduce((sum, item) => {
        const effectivePrice = getEffectiveProductPrice(item.product);

        return sum.plus(effectivePrice.mul(item.quantity));
      }, new Prisma.Decimal(0));

      // The browser sends only the delivery area key. Price comes from
      // server-side config so customers cannot lower delivery costs in devtools.
      const deliveryPrice = new Prisma.Decimal(deliveryArea.priceNis);
      const totalAmount = productsTotalAmount.plus(deliveryPrice);

      const createdOrder = await tx.order.create({
        data: {
          userId,
          idempotencyKey,
          totalAmount,
          deliveryAreaKey: deliveryArea.key,
          deliveryPrice,
          deliveryCity,
          deliveryAddress: deliveryAddress || null,
          deliveryNotes: deliveryNotes || null,
          pickupAgreementAccepted,
          stockDeductedAt: new Date(),
          paymentMethod: "CASH_ON_DELIVERY",
          paymentStatus: "UNPAID",
          customerNameAtPurchase: customer.name,
          customerEmailAtPurchase: customer.email,
          customerPhoneAtPurchase: phone,
          items: {
            create: cartItems.map((item) => {
              const effectivePrice = getEffectiveProductPrice(item.product);

              return {
                productId: item.productId,
                productVariantId: item.productVariant?.id ?? null,
                quantity: item.quantity,
                priceAtPurchase: effectivePrice,
                subtotalAmount: effectivePrice.mul(item.quantity),
                productNameAtPurchase: item.product.name,
                productSlugAtPurchase: item.product.slug,
                productImagesAtPurchase: item.product.images,
                selectedOptionLabel: item.productVariant?.optionLabel ?? null,
                selectedSizeLabel: item.productVariant?.sizeLabel ?? null,
                selectedColorLabel: item.productVariant?.colorLabel ?? null,
              };
            }),
          },
        },
        select: orderSelect,
      });

      if (customer.phone !== phone) {
        await tx.user.update({
          where: { id: userId },
          data: { phone },
        });
      }

      await tx.cartItem.deleteMany({
        where: {
          userId,
        },
      });

      const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

      return {
        order: createdOrder,
        receiptRecipient: customer.email,
        notification: {
          orderId: createdOrder.id,
          totalAmount: createdOrder.totalAmount.toString(),
          deliveryAreaKey: createdOrder.deliveryAreaKey ?? deliveryArea.key,
          deliveryCity: createdOrder.deliveryCity ?? deliveryCity,
          customerName: customer.name,
          customerPhone: phone,
          itemCount,
          createdAt: createdOrder.createdAt,
        } satisfies CreatedOrderNotification,
      };
    });

    // One deadline for both independent sends, after commit and outside locks.
    const emails: {
      action: string;
      message: string;
      send: (budget: EmailDeliveryBudget) => Promise<void>;
    }[] = [];
    if (orderResult.receiptRecipient) {
      const to = orderResult.receiptRecipient;
      emails.push({
        action: "orders.notifyCustomer",
        message: "Failed to send customer order receipt.",
        send: (budget) =>
          sendCustomerOrderReceiptEmail(
            { to, order: orderResult.order },
            budget,
          ),
      });
    }
    if (env.ORDER_NOTIFICATION_EMAIL && orderResult.notification) {
      const notification = orderResult.notification;
      emails.push({
        action: "orders.notifyOwner",
        message: "Failed to send store owner order notification.",
        send: (budget) => sendOrderNotificationEmail(notification, budget),
      });
    }
    const deliveries = await runCheckoutEmailWork(
      emails.map((email) => email.send),
    );
    deliveries.forEach((delivery, index) => {
      if (delivery.status === "fulfilled") return;
      // Keep preparation/transport errors out of route logs in every environment.
      logError(emails[index]!.message, new Error("Email delivery failed."), {
        action: emails[index]!.action,
        route: "/api/orders",
        userId,
        orderId: orderResult.order.id,
      });
    });

    return NextResponse.json({
      message:
        "Order placed successfully. The store owner will confirm it by WhatsApp or phone before processing.",
      order: serializeOrder(orderResult.order),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json(
        { message: "Your account could not be found." },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "EMAIL_NOT_VERIFIED") {
      return NextResponse.json(
        {
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before placing an order.",
        },
        { status: 403 },
      );
    }

    if (error instanceof Error && error.message === "EMPTY_CART") {
      return NextResponse.json(
        { message: "Your cart is empty." },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "PRODUCT_NOT_AVAILABLE") {
      return NextResponse.json(
        { message: "One or more products are no longer available." },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "VARIANT_REQUIRED") {
      return NextResponse.json(
        { message: "One or more products need a selected option." },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      (error.message === "VARIANT_NOT_ALLOWED" ||
        error.message === "VARIANT_NOT_AVAILABLE")
    ) {
      return NextResponse.json(
        {
          message: "One or more selected options are no longer available.",
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { message: "One or more products do not have enough stock." },
        { status: 400 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingOrder = await prisma.order.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
        select: orderSelect,
      });

      if (existingOrder) {
        return NextResponse.json({
          message:
            "Order placed successfully. The store owner will confirm it by WhatsApp or phone before processing.",
          order: serializeOrder(existingOrder),
        });
      }
    }

    const errorId = logError("Failed to place customer order.", error, {
      action: "orders.create",
      route: "/api/orders",
      userId,
    });

    return NextResponse.json(
      { message: getReferenceMessage("Failed to place order.", errorId) },
      { status: 500 },
    );
  }
}
