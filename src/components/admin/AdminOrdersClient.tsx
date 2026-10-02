"use client";
import { historicalOptionLabel } from "~/lib/sellable-options";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { OptimizedImage } from "~/components/ui/OptimizedImage";
import { formatDeliveryPriceNis, type DeliveryAreaKey } from "~/lib/delivery";

type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

type PaymentStatus = "UNPAID" | "PAID";

type OrderItem = {
  id: string;
  quantity: number;
  priceAtPurchase: string;
  subtotalAmount: string;
  productNameAtPurchase: string;
  productSlugAtPurchase: string;
  productImagesAtPurchase: string[];
  productVariantId: string | null;
  selectedOptionLabel?: string | null;
  selectedSizeLabel: string | null;
  selectedColorLabel: string | null;
};

type AdminOrderSummary = {
  id: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  totalAmount: string;
  customerNameAtPurchase: string | null;
  customerEmailAtPurchase: string | null;
  customerPhoneAtPurchase: string | null;
  deliveryAreaKey: DeliveryAreaKey | null;
  deliveryPrice: string;
  deliveryCity: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
};

type AdminOrderDetail = AdminOrderSummary & {
  stockDeductedAt: string | null;
  adminNote: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  pickupAgreementAccepted: boolean;
  items: OrderItem[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type AdminOrdersResponse = {
  orders?: AdminOrderSummary[];
  pagination?: Pagination;
  message?: string;
};

type AdminOrderDetailResponse = {
  order?: AdminOrderDetail;
  message?: string;
};

type OrderFilters = {
  q: string;
  status: "ALL" | OrderStatus;
  paymentStatus: "ALL" | PaymentStatus;
};

const orderStatuses: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const paymentStatuses: PaymentStatus[] = ["UNPAID", "PAID"];

const defaultFilters: OrderFilters = {
  q: "",
  status: "ALL",
  paymentStatus: "ALL",
};

const statusOptionsByCurrentStatus: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PENDING", "CANCELLED"],
  PROCESSING: ["PROCESSING", "SHIPPED", "CANCELLED"],
  SHIPPED: ["SHIPPED", "DELIVERED"],
  DELIVERED: ["DELIVERED"],
  CANCELLED: ["CANCELLED"],
};

const statusStyles: Record<OrderStatus, string> = {
  PENDING:
    "bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
  PROCESSING: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  SHIPPED:
    "bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  DELIVERED: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
  CANCELLED: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
  UNPAID:
    "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  PAID: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
};

function formatPrice(price: string | number, currency: string) {
  return `${Number(price).toFixed(2)} ${currency}`;
}

function formatDate(date: string, language: "en" | "ar") {
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatFallbackLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVariantSnapshotLabel(item: OrderItem) {
  return historicalOptionLabel(item);
}

function getShortOrderId(orderId: string) {
  return orderId.slice(-8).toUpperCase();
}

function OrderListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-36 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
      <div className="mt-5 h-64 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function AdminOrdersClient() {
  const { t, language } = useAppPreferences();

  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filters, setFilters] = useState<OrderFilters>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const pageRevenue = useMemo(() => {
    return orders.reduce((sum, order) => {
      if (order.status === "CANCELLED") {
        return sum;
      }

      return sum + Number(order.totalAmount);
    }, 0);
  }, [orders]);

  const pagePendingCount = useMemo(() => {
    return orders.filter((order) => order.status === "PENDING").length;
  }, [orders]);

  const pageUnpaidCount = useMemo(() => {
    return orders.filter((order) => order.paymentStatus === "UNPAID").length;
  }, [orders]);

  function getOrderStatusLabel(status: OrderStatus) {
    return t.admin.orders.statuses[status] ?? formatFallbackLabel(status);
  }

  function getPaymentStatusLabel(status: PaymentStatus) {
    return (
      t.admin.orders.paymentStatuses[status] ?? formatFallbackLabel(status)
    );
  }

  function getUnpaidNotice(count: number) {
    return t.admin.orders.unpaidNotice
      .replace("{count}", String(count))
      .replace("{plural}", count === 1 ? "" : "s");
  }

  function getDeliveryAreaLabel(deliveryAreaKey: DeliveryAreaKey | null) {
    if (!deliveryAreaKey) {
      return t.admin.orders.notProvided;
    }

    return (
      t.delivery.areas[deliveryAreaKey]?.label ??
      formatFallbackLabel(deliveryAreaKey)
    );
  }

  function getCustomerName(order: AdminOrderSummary | AdminOrderDetail) {
    return (
      order.customerNameAtPurchase ??
      order.user.name ??
      t.admin.orders.unnamedCustomer
    );
  }

  function getCustomerPhone(order: AdminOrderSummary | AdminOrderDetail) {
    return (
      order.customerPhoneAtPurchase ??
      order.user.phone ??
      t.admin.orders.notProvided
    );
  }

  function buildOrdersUrl(page: number, nextFilters: OrderFilters) {
    const searchParams = new URLSearchParams({
      page: String(page),
      limit: "20",
    });

    if (nextFilters.q.trim()) {
      searchParams.set("q", nextFilters.q.trim());
    }

    if (nextFilters.status !== "ALL") {
      searchParams.set("status", nextFilters.status);
    }

    if (nextFilters.paymentStatus !== "ALL") {
      searchParams.set("paymentStatus", nextFilters.paymentStatus);
    }

    return `/api/admin/orders?${searchParams.toString()}`;
  }

  async function loadOrders(page = 1, nextFilters = filters) {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(buildOrdersUrl(page, nextFilters));
      const data = (await response.json()) as AdminOrdersResponse;

      if (!response.ok) {
        setOrders([]);
        setPagination(null);
        setMessage(t.admin.orders.failedToLoad);
        return;
      }

      setOrders(data.orders ?? []);
      setPagination(data.pagination ?? null);
    } catch {
      setOrders([]);
      setPagination(null);
      setMessage(t.admin.orders.failedToConnect);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOrderDetails(orderId: string) {
    setIsDetailLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`);
      const data = (await response.json()) as AdminOrderDetailResponse;

      if (!response.ok || !data.order) {
        setSelectedOrder(null);
        setNoteDraft("");
        setMessage(t.admin.orders.failedToLoadDetails);
        return;
      }

      setSelectedOrder(data.order);
      setNoteDraft(data.order.adminNote ?? "");
    } catch {
      setSelectedOrder(null);
      setNoteDraft("");
      setMessage(t.admin.orders.failedToConnect);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function refreshCurrentView() {
    const currentPage = pagination?.page ?? 1;

    await loadOrders(currentPage, filters);

    if (selectedOrderId) {
      await loadOrderDetails(selectedOrderId);
    }
  }

  function scrollToDetailsOnMobile() {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    if (!window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }

    window.setTimeout(() => {
      detailPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function selectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setSelectedOrder(null);
    scrollToDetailsOnMobile();
    await loadOrderDetails(orderId);
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(t.admin.orders.failedToUpdateStatus);
        return;
      }

      await refreshCurrentView();
    } catch {
      setMessage(t.admin.orders.failedToConnect);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function updatePaymentStatus(orderId: string) {
    setUpdatingOrderId(orderId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentStatus: "PAID" }),
      });

      await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(t.admin.orders.failedToUpdatePayment);
        return;
      }

      await refreshCurrentView();
    } catch {
      setMessage(t.admin.orders.failedToConnect);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function saveAdminNote(orderId: string) {
    setUpdatingOrderId(orderId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/note`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminNote: noteDraft,
        }),
      });

      await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(t.admin.orders.failedToSaveNote);
        return;
      }

      await refreshCurrentView();
    } catch {
      setMessage(t.admin.orders.failedToConnect);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedOrderId(null);
    setSelectedOrder(null);
    void loadOrders(1, filters);
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setSelectedOrderId(null);
    setSelectedOrder(null);
    void loadOrders(1, defaultFilters);
  }

  function changePage(nextPage: number) {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    void loadOrders(nextPage, filters);
  }

  useEffect(() => {
    void loadOrders(1, defaultFilters);
    // Load once on mount. Language changes only affect labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (message && !isLoading && orders.length === 0) {
    return (
      <section className="workspace-ui rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-black text-zinc-950 dark:text-white">
          {t.admin.orders.unavailableTitle}
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {message}
        </p>

        <button
          type="button"
          onClick={() => void loadOrders(1, filters)}
          className="mt-6 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {t.admin.orders.tryAgain}
        </button>
      </section>
    );
  }

  return (
    <section className="workspace-ui space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold tracking-[0.2em] text-orange-600 uppercase dark:text-orange-400">
              {t.admin.orders.badge}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
              {t.admin.orders.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {t.admin.orders.description}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t.admin.orders.dashboard}
            </Link>
            <button
              type="button"
              onClick={() => void refreshCurrentView()}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {t.admin.orders.refresh}
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_auto] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="block">
          <span className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {t.admin.orders.search}
          </span>
          <input
            value={filters.q}
            onChange={(event) =>
              setFilters((current) => ({ ...current, q: event.target.value }))
            }
            placeholder={t.admin.orders.searchPlaceholder}
            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 transition outline-none placeholder:text-zinc-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {t.admin.orders.statusFilter}
          </span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as OrderFilters["status"],
              }))
            }
            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
          >
            <option value="ALL">{t.admin.orders.allStatuses}</option>
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {t.admin.orders.paymentFilter}
          </span>
          <select
            value={filters.paymentStatus}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                paymentStatus: event.target
                  .value as OrderFilters["paymentStatus"],
              }))
            }
            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
          >
            <option value="ALL">{t.admin.orders.allPaymentStatuses}</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {getPaymentStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col justify-end gap-2">
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {t.admin.orders.applyFilters}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t.admin.orders.clearFilters}
            </button>
          </div>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t.admin.orders.totalOrders}
          </p>
          <p className="mt-2 text-3xl font-black text-zinc-950 dark:text-white">
            {pagination?.total ?? orders.length}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t.admin.orders.pendingOrders}
          </p>
          <p className="mt-2 text-3xl font-black text-zinc-950 dark:text-white">
            {pagePendingCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.admin.orders.currentPageOnly}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t.admin.orders.revenueExcludingCancelled}
          </p>
          <p className="mt-2 text-3xl font-black text-zinc-950 dark:text-white">
            {formatPrice(pageRevenue, t.delivery.currency)}
          </p>
          {pageUnpaidCount > 0 ? (
            <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
              {getUnpaidNotice(pageUnpaidCount)}
            </p>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800 dark:border-orange-950 dark:bg-orange-950 dark:text-orange-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-zinc-950 dark:text-white">
              {t.admin.orders.orderCards}
            </h2>
            {pagination ? (
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {t.admin.orders.pageInfo
                  .replace("{page}", String(pagination.page))
                  .replace("{totalPages}", String(pagination.totalPages))}
              </p>
            ) : null}
          </div>

          {isLoading ? (
            <OrderListSkeleton />
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-xl font-black text-zinc-950 dark:text-white">
                {t.admin.orders.noOrdersTitle}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t.admin.orders.noOrdersDescription}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const selected = selectedOrderId === order.id;

                return (
                  <button
                    type="button"
                    key={order.id}
                    onClick={() => void selectOrder(order.id)}
                    className={`w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition hover:border-orange-300 hover:shadow-md dark:bg-zinc-900 ${
                      selected
                        ? "border-orange-500 ring-4 ring-orange-100 dark:ring-orange-950"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                          {t.admin.orders.order} #{getShortOrderId(order.id)}
                        </p>
                        <h3 className="mt-1 truncate text-lg font-black text-zinc-950 dark:text-white">
                          {getCustomerName(order)}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {getCustomerPhone(order)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[order.status]}`}
                        >
                          {getOrderStatusLabel(order.status)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatusStyles[order.paymentStatus]}`}
                        >
                          {getPaymentStatusLabel(order.paymentStatus)}
                        </span>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-950">
                        <dt className="text-zinc-500 dark:text-zinc-400">
                          {t.admin.orders.total}
                        </dt>
                        <dd className="mt-1 font-black text-zinc-950 dark:text-white">
                          {formatPrice(order.totalAmount, t.delivery.currency)}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-950">
                        <dt className="text-zinc-500 dark:text-zinc-400">
                          {t.admin.orders.placed}
                        </dt>
                        <dd className="mt-1 font-semibold text-zinc-950 dark:text-white">
                          {formatDate(order.createdAt, language)}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-950">
                        <dt className="text-zinc-500 dark:text-zinc-400">
                          {t.admin.orders.items}
                        </dt>
                        <dd className="mt-1 font-semibold text-zinc-950 dark:text-white">
                          {order.itemCount}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-950">
                        <dt className="text-zinc-500 dark:text-zinc-400">
                          {t.admin.orders.deliveryArea}
                        </dt>
                        <dd className="mt-1 truncate font-semibold text-zinc-950 dark:text-white">
                          {getDeliveryAreaLabel(order.deliveryAreaKey)}
                        </dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          )}

          {pagination ? (
            <div className="flex items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                disabled={!pagination.hasPreviousPage || isLoading}
                onClick={() => changePage(pagination.page - 1)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {t.admin.orders.previousPage}
              </button>

              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                {t.admin.orders.pageInfo
                  .replace("{page}", String(pagination.page))
                  .replace("{totalPages}", String(pagination.totalPages))}
              </span>

              <button
                type="button"
                disabled={!pagination.hasNextPage || isLoading}
                onClick={() => changePage(pagination.page + 1)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {t.admin.orders.nextPage}
              </button>
            </div>
          ) : null}
        </div>

        <div
          ref={detailPanelRef}
          className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start"
        >
          {isDetailLoading ? (
            <OrderDetailSkeleton />
          ) : selectedOrder ? (
            <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {(() => {
                const isUpdating = updatingOrderId === selectedOrder.id;
                const canMarkPaid =
                  selectedOrder.status === "DELIVERED" &&
                  selectedOrder.paymentStatus === "UNPAID";

                return (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                          {t.admin.orders.order} #
                          {getShortOrderId(selectedOrder.id)}
                        </p>
                        <h2 className="mt-1 text-2xl font-black text-zinc-950 dark:text-white">
                          {getCustomerName(selectedOrder)}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDate(selectedOrder.createdAt, language)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[selectedOrder.status]}`}
                        >
                          {getOrderStatusLabel(selectedOrder.status)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatusStyles[selectedOrder.paymentStatus]}`}
                        >
                          {getPaymentStatusLabel(selectedOrder.paymentStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {t.admin.orders.total}
                        </p>
                        <p className="mt-1 font-black text-zinc-950 dark:text-white">
                          {formatPrice(
                            selectedOrder.totalAmount,
                            t.delivery.currency,
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {t.admin.orders.deliveryPrice}
                        </p>
                        <p className="mt-1 font-semibold text-zinc-950 dark:text-white">
                          {formatDeliveryPriceNis(
                            Number(selectedOrder.deliveryPrice),
                            {
                              free: t.delivery.free,
                              currency: t.delivery.currency,
                            },
                          )}
                        </p>
                      </div>
                    </div>

                    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <h3 className="font-bold text-zinc-950 dark:text-white">
                        {t.admin.orders.orderActions}
                      </h3>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {selectedOrder.status === "PENDING" ? (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              void updateOrderStatus(
                                selectedOrder.id,
                                "PROCESSING",
                              )
                            }
                            className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdating
                              ? t.admin.orders.confirmingOrder
                              : t.admin.orders.confirmOrder}
                          </button>
                        ) : null}

                        <label className="block">
                          <span className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                            {t.admin.orders.orderStatus}
                          </span>
                          <select
                            value={selectedOrder.status}
                            disabled={isUpdating}
                            onChange={(event) =>
                              void updateOrderStatus(
                                selectedOrder.id,
                                event.target.value as OrderStatus,
                              )
                            }
                            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
                          >
                            {statusOptionsByCurrentStatus[
                              selectedOrder.status
                            ].map((status) => (
                              <option key={status} value={status}>
                                {getOrderStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        </label>

                        {canMarkPaid ? (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              void updatePaymentStatus(selectedOrder.id)
                            }
                            className="rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t.admin.orders.markPaid}
                          </button>
                        ) : null}
                      </div>

                      {selectedOrder.status === "PENDING" ? (
                        <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          {t.admin.orders.confirmOrderHelp}
                        </p>
                      ) : null}
                    </section>

                    <section>
                      <h3 className="font-bold text-zinc-950 dark:text-white">
                        {t.admin.orders.items}
                      </h3>

                      <div className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                        {selectedOrder.items.map((item) => {
                          const image = item.productImagesAtPurchase.at(0);

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                            >
                              <Link
                                href={`/products/${item.productSlugAtPurchase}`}
                                className="relative h-20 w-full shrink-0 overflow-hidden rounded-xl bg-zinc-100 sm:w-20 dark:bg-zinc-800"
                              >
                                {image ? (
                                  <OptimizedImage
                                    src={image}
                                    alt={item.productNameAtPurchase}
                                    sizes="80px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
                                    {t.admin.orders.noImage}
                                  </div>
                                )}
                              </Link>

                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/products/${item.productSlugAtPurchase}`}
                                  className="font-semibold text-zinc-950 transition hover:text-orange-600 dark:text-white dark:hover:text-orange-400"
                                >
                                  {item.productNameAtPurchase}
                                </Link>

                                {getVariantSnapshotLabel(item) ? (
                                  <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                    {getVariantSnapshotLabel(item)}
                                  </p>
                                ) : null}

                                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                  {item.quantity} ×{" "}
                                  {formatPrice(
                                    item.priceAtPurchase,
                                    t.delivery.currency,
                                  )}
                                </p>
                              </div>

                              <p className="font-black text-zinc-950 dark:text-white">
                                {formatPrice(
                                  item.subtotalAmount,
                                  t.delivery.currency,
                                )}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <h3 className="font-bold text-zinc-950 dark:text-white">
                          {t.admin.orders.contactDetails}
                        </h3>

                        <dl className="mt-3 space-y-3">
                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t.admin.orders.customerName}
                            </dt>
                            <dd className="mt-1 font-semibold text-zinc-950 dark:text-white">
                              {getCustomerName(selectedOrder)}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t.admin.orders.customerEmail}
                            </dt>
                            <dd className="mt-1 font-semibold break-words text-zinc-950 dark:text-white">
                              {selectedOrder.customerEmailAtPurchase ??
                                selectedOrder.user.email}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t.admin.orders.customerPhone}
                            </dt>
                            <dd className="mt-1 font-semibold text-zinc-950 dark:text-white">
                              {getCustomerPhone(selectedOrder)}
                            </dd>
                          </div>
                        </dl>
                      </section>

                      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <h3 className="font-bold text-zinc-950 dark:text-white">
                          {t.admin.orders.deliveryDetails}
                        </h3>

                        <dl className="mt-3 space-y-3">
                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t.admin.orders.deliveryArea}
                            </dt>
                            <dd className="mt-1 font-semibold text-zinc-950 dark:text-white">
                              {getDeliveryAreaLabel(
                                selectedOrder.deliveryAreaKey,
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t.admin.orders.deliveryCity}
                            </dt>
                            <dd className="mt-1 font-semibold text-zinc-950 dark:text-white">
                              {selectedOrder.deliveryCity ??
                                t.admin.orders.notProvided}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t.admin.orders.deliveryAddress}
                            </dt>
                            <dd className="mt-1 font-semibold whitespace-pre-wrap text-zinc-950 dark:text-white">
                              {selectedOrder.deliveryAddress ??
                                t.admin.orders.notProvided}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t.admin.orders.pickupAgreement}
                            </dt>
                            <dd className="mt-1 font-semibold text-zinc-950 dark:text-white">
                              {selectedOrder.deliveryAreaKey ===
                              "nablus_receive_point"
                                ? selectedOrder.pickupAgreementAccepted
                                  ? t.admin.orders.yes
                                  : t.admin.orders.notProvided
                                : t.admin.orders.notRequired}
                            </dd>
                          </div>

                          {selectedOrder.deliveryNotes ? (
                            <div>
                              <dt className="text-zinc-500 dark:text-zinc-400">
                                {t.admin.orders.deliveryNotes}
                              </dt>
                              <dd className="mt-1 font-semibold whitespace-pre-wrap text-zinc-950 dark:text-white">
                                {selectedOrder.deliveryNotes}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </section>
                    </div>

                    <div>
                      <label
                        htmlFor={`note-${selectedOrder.id}`}
                        className="text-sm font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
                      >
                        {t.admin.orders.adminNote}
                      </label>

                      <textarea
                        id={`note-${selectedOrder.id}`}
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder={t.admin.orders.adminNotePlaceholder}
                        rows={6}
                        className="mt-3 w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none placeholder:text-zinc-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
                      />

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void saveAdminNote(selectedOrder.id)}
                        className="mt-3 w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                      >
                        {isUpdating
                          ? t.admin.orders.saving
                          : t.admin.orders.saveNote}
                      </button>

                      <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {t.admin.orders.noteWarning}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </article>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-xl font-black text-zinc-950 dark:text-white">
                {t.admin.orders.selectOrderTitle}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t.admin.orders.selectOrderDescription}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
