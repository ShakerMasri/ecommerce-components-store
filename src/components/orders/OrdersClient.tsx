"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { OptimizedImage } from "~/components/ui/OptimizedImage";
import { formatDeliveryPriceNis, type DeliveryAreaKey } from "~/lib/delivery";

type OrderItem = {
  id: string;
  quantity: number;
  priceAtPurchase: string;
  subtotalAmount: string;
  productNameAtPurchase: string;
  productSlugAtPurchase: string;
  productImagesAtPurchase: string[];
  productVariantId: string | null;
  selectedSizeLabel: string | null;
  selectedColorLabel: string | null;
};

type Order = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: string;
  deliveryAreaKey: DeliveryAreaKey | null;
  deliveryPrice: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  pickupAgreementAccepted: boolean;
  createdAt: string;
  items: OrderItem[];
};

type OrdersPagination = {
  page: number;
  limit: number;
  hasNextPage: boolean;
  nextPage: number | null;
};

type OrdersSummary = {
  totalOrders: number;
  activeOrdersCount: number;
  totalSpent: string;
};

type OrdersResponse = {
  orders?: Order[];
  pagination?: OrdersPagination;
  summary?: OrdersSummary;
  message?: string;
};

const statusStyles: Record<string, string> = {
  PENDING:
    "bg-[var(--surface-muted)] text-[var(--accent-strong)] ring-[var(--accent-soft)]",
  PROCESSING:
    "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[var(--accent-soft)]",
  SHIPPED:
    "bg-[var(--surface-muted)] text-[var(--accent-strong)] ring-[var(--line-soft)]",
  DELIVERED:
    "bg-[var(--success-soft)] text-[var(--success-ink)] ring-[var(--success-soft)]",
  CANCELLED:
    "bg-[var(--danger-soft)] text-[var(--danger-ink)] ring-[var(--danger-soft)]",
};

const paymentStatusStyles: Record<string, string> = {
  UNPAID: "bg-[var(--surface-muted)] text-[var(--ink)] ring-[var(--line-soft)]",
  PAID: "bg-[var(--success-soft)] text-[var(--success-ink)] ring-[var(--success-soft)]",
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
  return [item.selectedSizeLabel, item.selectedColorLabel]
    .filter(Boolean)
    .join(" / ");
}

export function OrdersClient() {
  const { t, language } = useAppPreferences();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<OrdersPagination | null>(null);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [isAuthRequired, setIsAuthRequired] = useState(false);

  const totalSpent = useMemo(() => {
    if (summary) {
      return Number(summary.totalSpent);
    }

    return orders.reduce((sum, order) => {
      if (order.status === "CANCELLED") {
        return sum;
      }

      return sum + Number(order.totalAmount);
    }, 0);
  }, [orders, summary]);

  const activeOrdersCount = useMemo(() => {
    if (summary) {
      return summary.activeOrdersCount;
    }

    return orders.filter((order) => {
      return order.status !== "DELIVERED" && order.status !== "CANCELLED";
    }).length;
  }, [orders, summary]);

  const totalOrdersCount = summary?.totalOrders ?? orders.length;

  function getStatusLabel(status: string) {
    return t.orders.statuses[status] ?? formatFallbackLabel(status);
  }

  function getPaymentMethodLabel(paymentMethod: string) {
    return (
      t.orders.paymentMethods[paymentMethod] ??
      formatFallbackLabel(paymentMethod)
    );
  }

  function getPaymentStatusLabel(paymentStatus: string) {
    return (
      t.orders.paymentStatuses[paymentStatus] ??
      formatFallbackLabel(paymentStatus)
    );
  }

  function getDeliveryAreaLabel(deliveryAreaKey: DeliveryAreaKey | null) {
    if (!deliveryAreaKey) {
      return t.orders.notProvided;
    }

    return (
      t.delivery.areas[deliveryAreaKey]?.label ??
      formatFallbackLabel(deliveryAreaKey)
    );
  }

  async function loadOrders(options?: { page?: number; append?: boolean }) {
    const page = options?.page ?? 1;
    const append = options?.append ?? false;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setOrders([]);
      setPagination(null);
      setSummary(null);
    }

    setMessage("");
    setIsAuthRequired(false);

    try {
      const response = await fetch(`/api/orders?page=${page}&limit=20`);
      const data = (await response.json()) as OrdersResponse;

      if (!response.ok) {
        if (!append) {
          setOrders([]);
          setPagination(null);
          setSummary(null);
        }

        if (response.status === 401) {
          setIsAuthRequired(true);
        }

        setMessage(t.orders.failedToLoad);
        return;
      }

      const nextOrders = data.orders ?? [];

      setOrders((currentOrders) =>
        append ? [...currentOrders, ...nextOrders] : nextOrders,
      );
      setPagination(data.pagination ?? null);
      setSummary(data.summary ?? null);
    } catch {
      if (!append) {
        setOrders([]);
        setPagination(null);
        setSummary(null);
      }

      setMessage(t.orders.failedToConnect);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadOrders();
    // We intentionally load once on mount. Language changes only affect labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5">
          <div className="h-8 w-44 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-[var(--surface-muted)]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-3xl bg-[var(--surface-muted)]"
            />
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-3xl bg-[var(--surface-muted)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (message && orders.length === 0) {
    return (
      <section className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-8 text-center shadow-sm shadow-black/5">
        <h1 className="text-2xl font-black text-[var(--ink)]">
          {t.orders.ordersUnavailable}
        </h1>

        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {message}
        </p>

        {isAuthRequired ? (
          <Link
            href="/login?callbackUrl=/orders"
            className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
          >
            {t.auth.login}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-6 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
          >
            {t.orders.tryAgain}
          </button>
        )}
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-8 text-center shadow-sm shadow-black/5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)] text-2xl">
          📦
        </div>

        <h1 className="mt-5 text-2xl font-black text-[var(--ink)]">
          {t.orders.noOrdersTitle}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--ink-muted)]">
          {t.orders.noOrdersDescription}
        </p>

        <Link
          href="/products"
          className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
        >
          {t.orders.browseProducts}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5 sm:p-6">
        <p className="text-sm font-semibold tracking-wide text-[var(--accent)] uppercase">
          {t.orders.badge}
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--ink)] sm:text-4xl">
              {t.orders.title}
            </h1>

            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {t.orders.description}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="w-fit rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
          >
            {t.orders.refresh}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5">
          <p className="text-sm text-[var(--ink-muted)]">
            {t.orders.totalOrders}
          </p>
          <p className="mt-2 text-2xl font-black text-[var(--accent-strong)]">
            {totalOrdersCount}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5">
          <p className="text-sm text-[var(--ink-muted)]">
            {t.orders.activeOrders}
          </p>
          <p className="mt-2 text-2xl font-black text-[var(--accent-strong)]">
            {activeOrdersCount}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5">
          <p className="text-sm text-[var(--ink-muted)]">
            {t.orders.totalSpent}
          </p>
          <p className="mt-2 text-2xl font-black text-[var(--accent-strong)]">
            {formatPrice(totalSpent, t.delivery.currency)}
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4 text-sm font-medium text-[var(--danger-ink)]">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const statusClass =
            statusStyles[order.status] ??
            "bg-[var(--surface-muted)] text-[var(--ink)]";

          const paymentStatusClass =
            paymentStatusStyles[order.paymentStatus] ??
            "bg-[var(--surface-muted)] text-[var(--ink)]";

          return (
            <article
              key={order.id}
              className="overflow-hidden rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--surface-card)] shadow-sm shadow-black/5"
            >
              <div className="border-b border-[var(--line-soft)] bg-[var(--surface-muted)] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-[var(--ink-muted)] uppercase">
                      {t.orders.order}
                    </p>

                    <h2 className="mt-1 max-w-full truncate font-mono text-sm font-bold text-[var(--ink)]">
                      {order.id}
                    </h2>

                    <p className="mt-2 text-sm text-[var(--ink-muted)]">
                      {t.orders.placed} {formatDate(order.createdAt, language)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${paymentStatusClass}`}
                    >
                      {getPaymentStatusLabel(order.paymentStatus)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-[var(--surface-card)] p-4 ring-1 ring-[var(--accent-soft)]">
                    <p className="text-[var(--ink-muted)]">{t.orders.total}</p>
                    <p className="mt-1 font-black text-[var(--accent-strong)]">
                      {formatPrice(order.totalAmount, t.delivery.currency)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--surface-card)] p-4 ring-1 ring-[var(--accent-soft)]">
                    <p className="text-[var(--ink-muted)]">
                      {t.orders.deliveryPrice}
                    </p>
                    <p className="mt-1 font-semibold text-[var(--ink)]">
                      {formatDeliveryPriceNis(Number(order.deliveryPrice), {
                        free: t.delivery.free,
                        currency: t.delivery.currency,
                      })}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--surface-card)] p-4 ring-1 ring-[var(--accent-soft)]">
                    <p className="text-[var(--ink-muted)]">
                      {t.orders.payment}
                    </p>
                    <p className="mt-1 font-semibold text-[var(--ink)]">
                      {getPaymentMethodLabel(order.paymentMethod)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--surface-card)] p-4 ring-1 ring-[var(--accent-soft)]">
                    <p className="text-[var(--ink-muted)]">{t.orders.items}</p>
                    <p className="mt-1 font-semibold text-[var(--ink)]">
                      {order.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-4 text-sm">
                  <h3 className="font-bold text-[var(--ink)]">
                    {t.orders.deliveryDetails}
                  </h3>

                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--ink-muted)]">
                        {t.orders.deliveryArea}
                      </dt>
                      <dd className="mt-1 font-semibold text-[var(--ink)]">
                        {getDeliveryAreaLabel(order.deliveryAreaKey)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-[var(--ink-muted)]">
                        {t.orders.deliveryCity}
                      </dt>
                      <dd className="mt-1 font-semibold text-[var(--ink)]">
                        {order.deliveryCity ?? t.orders.notProvided}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-[var(--ink-muted)]">
                        {t.orders.deliveryAddress}
                      </dt>
                      <dd className="mt-1 font-semibold text-[var(--ink)]">
                        {order.deliveryAddress ?? t.orders.notProvided}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-[var(--ink-muted)]">
                        {t.orders.pickupAgreement}
                      </dt>
                      <dd className="mt-1 font-semibold text-[var(--ink)]">
                        {order.deliveryAreaKey === "nablus_receive_point"
                          ? order.pickupAgreementAccepted
                            ? t.orders.yes
                            : t.orders.notProvided
                          : t.orders.notRequired}
                      </dd>
                    </div>

                    {order.deliveryNotes ? (
                      <div className="sm:col-span-2">
                        <dt className="text-[var(--ink-muted)]">
                          {t.orders.deliveryNotes}
                        </dt>
                        <dd className="mt-1 font-semibold whitespace-pre-wrap text-[var(--ink)]">
                          {order.deliveryNotes}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </div>

              <div className="divide-y divide-[var(--line-soft)]">
                {order.items.map((item) => {
                  const image = item.productImagesAtPurchase.at(0);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6"
                    >
                      <Link
                        href={`/products/${item.productSlugAtPurchase}`}
                        className="relative h-24 w-full shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--accent-soft)] sm:w-24"
                      >
                        {image ? (
                          <OptimizedImage
                            src={image}
                            alt={item.productNameAtPurchase}
                            sizes="96px"
                            className="object-contain p-2"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-[var(--ink-muted)]">
                            {t.orders.noImage}
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${item.productSlugAtPurchase}`}
                          className="font-bold break-words text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
                        >
                          {item.productNameAtPurchase}
                        </Link>

                        {getVariantSnapshotLabel(item) ? (
                          <p className="mt-2 inline-flex w-fit rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--accent-soft)]">
                            {getVariantSnapshotLabel(item)}
                          </p>
                        ) : null}

                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                          {t.orders.quantity}: {item.quantity} ×{" "}
                          {formatPrice(
                            item.priceAtPurchase,
                            t.delivery.currency,
                          )}
                        </p>
                      </div>

                      <div className="text-start sm:text-end">
                        <p className="text-sm text-[var(--ink-muted)]">
                          {t.orders.subtotal}
                        </p>
                        <p className="font-black text-[var(--accent-strong)]">
                          {formatPrice(
                            item.subtotalAmount,
                            t.delivery.currency,
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {pagination?.hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (pagination.nextPage) {
                void loadOrders({ page: pagination.nextPage, append: true });
              }
            }}
            disabled={isLoadingMore}
            className="rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? t.orders.loadingMore : t.orders.loadMore}
          </button>
        </div>
      ) : null}
    </section>
  );
}
