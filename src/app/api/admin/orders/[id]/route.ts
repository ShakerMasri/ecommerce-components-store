import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "~/lib/admin";
import { prisma } from "~/lib/prisma";
import { adminOrderParamsSchema } from "~/server/validations/admin-order";

const adminOrderDetailSelect = {
  id: true,
  status: true,
  totalAmount: true,
  paymentMethod: true,
  paymentStatus: true,
  stockDeductedAt: true,
  adminNote: true,
  customerNameAtPurchase: true,
  customerEmailAtPurchase: true,
  customerPhoneAtPurchase: true,
  deliveryAreaKey: true,
  deliveryPrice: true,
  deliveryCity: true,
  deliveryAddress: true,
  deliveryNotes: true,
  pickupAgreementAccepted: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  items: {
    select: {
      id: true,
      quantity: true,
      priceAtPurchase: true,
      subtotalAmount: true,
      productNameAtPurchase: true,
      productSlugAtPurchase: true,
      productImagesAtPurchase: true,
      productId: true,
      productVariantId: true,
      selectedOptionLabel: true,
      selectedSizeLabel: true,
      selectedColorLabel: true,
    },
    orderBy: {
      id: "asc",
    },
  },
} satisfies Prisma.OrderSelect;

type AdminOrderDetail = Prisma.OrderGetPayload<{
  select: typeof adminOrderDetailSelect;
}>;

function serializeAdminOrderDetail(order: AdminOrderDetail) {
  return {
    ...order,
    totalAmount: order.totalAmount.toString(),
    deliveryPrice: order.deliveryPrice.toString(),
    stockDeductedAt: order.stockDeductedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      ...item,
      priceAtPurchase: item.priceAtPurchase.toString(),
      subtotalAmount: item.subtotalAmount.toString(),
    })),
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;

  const parsedParams = adminOrderParamsSchema.safeParse({ id });

  if (!parsedParams.success) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        id: parsedParams.data.id,
      },
      select: adminOrderDetailSelect,
    });

    if (!order) {
      return NextResponse.json(
        { message: "Order not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      order: serializeAdminOrderDetail(order),
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to load order." },
      { status: 500 },
    );
  }
}
