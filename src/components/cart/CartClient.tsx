"use client";

import Link from "next/link";
import { updateProfileSchema } from "~/lib/validations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OptimizedImage } from "~/components/ui/OptimizedImage";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { getPublicTaxDisclosure } from "~/config/legal-business";
import {
  DEFAULT_DELIVERY_AREA_KEY,
  DELIVERY_AREAS,
  formatDeliveryPriceNis,
  getDeliveryAreaByKey,
  type DeliveryAreaKey,
} from "~/lib/delivery";

type CartProduct = {
  id: string;
  name: string;
  slug: string;
  price: string;
  discountPrice: string | null;
  stock: number | null;
  isInStock: boolean;
  images: string[];
  isArchived: boolean;
  showStock: boolean;
  hasVariants: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
};

type CartVariant = {
  id: string;
  sizeLabel: string | null;
  colorLabel: string | null;
  stock: number | null;
  isInStock: boolean;
  isActive: boolean;
};

type CartItem = {
  id: string;
  quantity: number;
  productVariantId: string | null;
  productVariant: CartVariant | null;
  availableStock: number | null;
  isAvailable: boolean;
  hasEnoughStock: boolean;
  product: CartProduct;
};

type CartCustomer = {
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
};

type CartResponse = {
  cartItems?: CartItem[];
  customer?: CartCustomer;
  message?: string;
};

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
  deliveryAreaKey: DeliveryAreaKey;
  deliveryPrice: string;
  deliveryCity: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  pickupAgreementAccepted: boolean;
  createdAt: string;
  items: OrderItem[];
};

type CheckoutResponse = {
  errors?: { phone?: string[] };
  message?: string;
  order?: Order;
};

type DeliveryFormState = {
  deliveryAreaKey: DeliveryAreaKey;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryNotes: string;
  pickupAgreementAccepted: boolean;
};

type DeliveryValidationErrors = {
  phone: string | null;
  city: string | null;
  address: string | null;
  pickupAgreement: string | null;
};

const defaultDeliveryForm: DeliveryFormState = {
  deliveryAreaKey: DEFAULT_DELIVERY_AREA_KEY,
  deliveryCity: "",
  deliveryAddress: "",
  deliveryNotes: "",
  pickupAgreementAccepted: false,
};

function formatPrice(amount: number) {
  return `₪${amount.toFixed(2)}`;
}

function getEffectiveCartPrice(product: CartProduct) {
  return Number(product.discountPrice ?? product.price);
}

function hasCartDiscount(product: CartProduct) {
  return product.discountPrice !== null;
}

function formatVariantLabel(variant: CartVariant | null) {
  if (!variant) {
    return null;
  }

  const label = [variant.sizeLabel, variant.colorLabel]
    .filter(Boolean)
    .join(" / ");

  return label || null;
}

export function CartClient() {
  const { language, t } = useAppPreferences();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CartCustomer | null>(null);
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [phoneServerError, setPhoneServerError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [deliveryForm, setDeliveryForm] =
    useState<DeliveryFormState>(defaultDeliveryForm);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [deliveryValidationAttempted, setDeliveryValidationAttempted] =
    useState(false);
  const checkoutKeyRef = useRef<string | null>(null);
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const phone = phoneInput ?? customer?.phone ?? "";

  const selectedDeliveryArea =
    getDeliveryAreaByKey(deliveryForm.deliveryAreaKey) ?? DELIVERY_AREAS[0]!;
  const selectedDeliveryTranslation =
    t.delivery.areas[selectedDeliveryArea.key];
  const selectedDeliveryPrice = selectedDeliveryArea.priceNis;

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      return sum + getEffectiveCartPrice(item.product) * item.quantity;
    }, 0);
  }, [cartItems]);

  const finalTotal = total + selectedDeliveryPrice;
  const taxDisclosure = getPublicTaxDisclosure(language);

  const itemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  const hasUnavailableItems = cartItems.some((item) => {
    return item.product.isArchived || !item.isAvailable || !item.hasEnoughStock;
  });

  const loadCart = useCallback(
    async function loadCart() {
      setIsLoading(true);
      setMessage("");
      setIsAuthRequired(false);

      try {
        const response = await fetch("/api/cart");
        const data = (await response.json()) as CartResponse;

        if (!response.ok) {
          setCartItems([]);
          setCustomer(null);

          if (response.status === 401) {
            setIsAuthRequired(true);
          }

          setMessage(t.cart.failedToLoad);
          return;
        }

        setCartItems(data.cartItems ?? []);
        setCustomer(data.customer ?? null);
      } catch {
        setCartItems([]);
        setCustomer(null);
        setMessage(t.cart.failedToConnect);
      } finally {
        setIsLoading(false);
      }
    },
    [t.cart.failedToConnect, t.cart.failedToLoad],
  );

  async function updateQuantity(cartItemId: string, quantity: number) {
    setUpdatingItemId(cartItemId);
    setMessage("");

    try {
      const response = await fetch(`/api/cart/items/${cartItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity }),
      });

      await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthRequired(true);
        }

        setMessage(t.cart.failedToUpdate);
        return;
      }

      await loadCart();
    } catch {
      setMessage(t.cart.failedToConnect);
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function removeItem(cartItemId: string) {
    setRemovingItemId(cartItemId);
    setMessage("");

    try {
      const response = await fetch(`/api/cart/items/${cartItemId}`, {
        method: "DELETE",
      });

      await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthRequired(true);
        }

        setMessage(t.cart.failedToRemove);
        return;
      }

      await loadCart();
    } catch {
      setMessage(t.cart.failedToConnect);
    } finally {
      setRemovingItemId(null);
    }
  }

  function updateDeliveryForm<Field extends keyof DeliveryFormState>(
    field: Field,
    value: DeliveryFormState[Field],
  ) {
    setDeliveryForm((current) => ({
      ...current,
      [field]: value,
    }));
    setMessage("");
  }

  function updateDeliveryArea(deliveryAreaKey: DeliveryAreaKey) {
    const deliveryArea = getDeliveryAreaByKey(deliveryAreaKey);

    setDeliveryForm((current) => ({
      ...current,
      deliveryAreaKey,
      pickupAgreementAccepted: deliveryArea?.requiresCustomerAgreement
        ? current.pickupAgreementAccepted
        : false,
    }));
    setMessage("");
  }

  function getDeliveryValidationErrors(): DeliveryValidationErrors {
    const city =
      deliveryForm.deliveryCity.trim().length < 2
        ? t.cart.deliveryCityRequired
        : null;

    const pickupAgreement =
      selectedDeliveryArea.requiresCustomerAgreement &&
      !deliveryForm.pickupAgreementAccepted
        ? t.cart.pickupAgreementRequired
        : null;

    const address =
      !selectedDeliveryArea.requiresCustomerAgreement &&
      deliveryForm.deliveryAddress.trim().length < 5
        ? t.cart.deliveryAddressRequired
        : null;

    const phoneError =
      phoneServerError ||
      !updateProfileSchema.shape.phone.safeParse(phone).success
        ? t.auth.phoneInvalid
        : null;

    return { city, address, pickupAgreement, phone: phoneError };
  }

  function getFirstDeliveryValidationError(errors: DeliveryValidationErrors) {
    return (
      errors.phone ?? errors.city ?? errors.pickupAgreement ?? errors.address
    );
  }

  function reviewOrder() {
    if (
      checkoutStatus === "loading" ||
      checkoutStatus === "success" ||
      hasUnavailableItems ||
      cartItems.length === 0
    ) {
      return;
    }

    setDeliveryValidationAttempted(true);

    const validationError = getFirstDeliveryValidationError(
      getDeliveryValidationErrors(),
    );

    if (validationError) {
      setMessage("");
      return;
    }

    setMessage("");
    setIsConfirmingOrder(true);
  }

  async function placeOrder() {
    if (
      checkoutStatus === "loading" ||
      checkoutStatus === "success" ||
      hasUnavailableItems ||
      cartItems.length === 0
    ) {
      return;
    }

    setDeliveryValidationAttempted(true);

    const validationError = getFirstDeliveryValidationError(
      getDeliveryValidationErrors(),
    );

    if (validationError) {
      setIsConfirmingOrder(false);
      setMessage("");
      return;
    }

    setCheckoutStatus("loading");
    setMessage("");

    checkoutKeyRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: checkoutKeyRef.current,
          phone,
          deliveryAreaKey: deliveryForm.deliveryAreaKey,
          deliveryCity: deliveryForm.deliveryCity.trim(),
          deliveryAddress: deliveryForm.deliveryAddress.trim(),
          deliveryNotes: deliveryForm.deliveryNotes.trim(),
          pickupAgreementAccepted: deliveryForm.pickupAgreementAccepted,
        }),
      });

      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.order) {
        if (response.status === 401) {
          setIsAuthRequired(true);
        }

        setCheckoutStatus("error");
        setIsConfirmingOrder(false);
        setPhoneServerError(Boolean(data.errors?.phone?.length));
        setMessage(data.errors?.phone?.length ? "" : t.cart.failedToPlaceOrder);
        return;
      }

      setCheckoutStatus("success");
      setIsConfirmingOrder(false);
      setPlacedOrder(data.order);
      setCartItems([]);
    } catch {
      setCheckoutStatus("error");
      setIsConfirmingOrder(false);
      setMessage(t.cart.failedToConnect);
    }
  }

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    if (!isConfirmingOrder) return;
    const dialog = confirmationRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [isConfirmingOrder]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm">
          <div className="h-8 w-40 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-[var(--surface-muted)]" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-4 shadow-sm shadow-black/5"
              >
                <div className="flex gap-4">
                  <div className="h-24 w-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--surface-muted)]" />
                    <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
                    <div className="h-9 w-32 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-52 animate-pulse rounded-3xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    );
  }

  if (placedOrder) {
    const placedDeliveryAreaLabel =
      t.delivery.areas[placedOrder.deliveryAreaKey]?.label ??
      placedOrder.deliveryAreaKey;

    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--success-soft)] bg-[var(--success-soft)] p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-ink)] text-xl font-black text-[var(--surface-page)]">
          ✓
        </div>

        <h1 className="mt-5 text-2xl font-black text-[var(--success-ink)]">
          {t.cart.orderPlacedTitle}
        </h1>

        <p className="mt-2 text-sm leading-6 text-[var(--success-ink)]">
          {t.cart.orderPlacedDescription}
        </p>

        <div className="mt-6 space-y-3 rounded-2xl bg-[var(--surface-card)] p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--ink-muted)]">{t.cart.orderId}</span>
            <span className="max-w-44 truncate font-mono text-xs font-semibold text-[var(--ink)]">
              {placedOrder.id}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--ink-muted)]">
              {t.cart.deliveryArea}
            </span>
            <span className="text-end font-semibold text-[var(--ink)]">
              {placedDeliveryAreaLabel}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--ink-muted)]">
              {t.cart.deliveryPrice}
            </span>
            <span className="font-semibold text-[var(--ink)]">
              {formatDeliveryPriceNis(Number(placedOrder.deliveryPrice), {
                free: t.delivery.free,
                currency: t.delivery.currency,
              })}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--ink-muted)]">{t.cart.total}</span>
            <span className="font-bold text-[var(--ink)]">
              {formatPrice(Number(placedOrder.totalAmount))}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--ink-muted)]">{t.cart.payment}</span>
            <span className="font-semibold text-[var(--ink)]">
              {t.cart.cashOnDelivery}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--ink-muted)]">{t.cart.status}</span>
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {placedOrder.status}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/orders"
            className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-center text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)]"
          >
            {t.cart.viewOrders}
          </Link>

          <Link
            href="/products"
            className="rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-5 py-2.5 text-center text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)]"
          >
            {t.cart.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  if (message && cartItems.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-[var(--ink)]">
          {t.cart.cartUnavailable}
        </h1>

        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {message}
        </p>

        {isAuthRequired ? (
          <Link
            href="/login?callbackUrl=/cart"
            className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)]"
          >
            {t.auth.login}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void loadCart()}
            className="mt-6 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)]"
          >
            {t.cart.tryAgain}
          </button>
        )}
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)] text-2xl">
          🛒
        </div>

        <h1 className="mt-5 text-2xl font-black text-[var(--ink)]">
          {t.cart.emptyTitle}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--ink-muted)]">
          {t.cart.emptyDescription}
        </p>

        <Link
          href="/products"
          className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)]"
        >
          {t.actions.browseProducts}
        </Link>
      </div>
    );
  }

  const deliveryValidationErrors = getDeliveryValidationErrors();
  const deliveryValidationMessage = deliveryValidationAttempted
    ? getFirstDeliveryValidationError(deliveryValidationErrors)
    : null;
  const submitAreaMessage =
    deliveryValidationMessage ?? (checkoutStatus === "error" ? message : null);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5 sm:p-6">
        <p className="text-sm font-semibold tracking-wide text-[var(--accent)] uppercase">
          {t.cart.badge}
        </p>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--ink)] sm:text-4xl">
              {t.cart.title}
            </h1>

            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {t.cart.description}
            </p>
          </div>

          <p className="w-fit rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--accent-soft)]">
            {itemCount}{" "}
            {itemCount === 1 ? t.cart.itemSingular : t.cart.itemPlural}
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4 text-sm font-medium text-[var(--danger-ink)]">
          {message}
        </div>
      )}

      {hasUnavailableItems && (
        <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4 text-sm font-medium text-[var(--accent-strong)]">
          {t.cart.unavailableNotice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-4">
          {cartItems.map((item) => {
            const image = item.product.images.at(0);
            const isArchived = item.product.isArchived;
            const isOutOfStock = !item.isAvailable;
            const exceedsStock = !item.hasEnoughStock;
            const variantLabel = formatVariantLabel(item.productVariant);
            const isUnavailable = isArchived || isOutOfStock || exceedsStock;
            const isUpdating = updatingItemId === item.id;
            const isRemoving = removingItemId === item.id;
            const itemUnitPrice = getEffectiveCartPrice(item.product);
            const itemHasDiscount = hasCartDiscount(item.product);
            const itemSubtotal = itemUnitPrice * item.quantity;

            return (
              <article
                key={item.id}
                className="rounded-[1.75rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-4 shadow-sm shadow-black/5"
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="relative h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--accent-soft)] sm:h-28 sm:w-28"
                  >
                    {image ? (
                      <OptimizedImage
                        src={image}
                        alt={item.product.name}
                        sizes="(max-width: 640px) 100vw, 112px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--ink-muted)]">
                        {t.cart.noImage}
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-[var(--accent)] uppercase">
                          {item.product.category.name}
                        </p>

                        <Link
                          href={`/products/${item.product.slug}`}
                          className="mt-1 block text-base font-bold break-words text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
                        >
                          {item.product.name}
                        </Link>

                        {variantLabel ? (
                          <p className="mt-2 inline-flex w-fit rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--accent-soft)]">
                            {variantLabel}
                          </p>
                        ) : null}

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-bold text-[var(--accent-strong)]">
                            {formatPrice(itemUnitPrice)}
                          </span>

                          {itemHasDiscount && (
                            <span className="text-xs text-[var(--ink-muted)] line-through">
                              {formatPrice(Number(item.product.price))}
                            </span>
                          )}

                          <span className="text-[var(--ink-muted)]">
                            {t.cart.each}
                          </span>
                        </div>
                      </div>

                      <p className="text-lg font-black text-[var(--accent-strong)]">
                        {formatPrice(itemSubtotal)}
                      </p>
                    </div>

                    {isUnavailable && (
                      <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger-ink)]">
                        {isArchived
                          ? t.cart.productArchived
                          : isOutOfStock
                            ? t.cart.productOutOfStock
                            : item.product.showStock &&
                                item.availableStock !== null
                              ? t.cart.onlyLeft.replace(
                                  "{stock}",
                                  String(item.availableStock),
                                )
                              : t.cart.requestedQuantityUnavailable}
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex w-fit items-center overflow-hidden rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] shadow-sm shadow-black/5">
                        <button
                          type="button"
                          disabled={
                            item.quantity <= 1 || isUpdating || isRemoving
                          }
                          onClick={() =>
                            void updateQuantity(item.id, item.quantity - 1)
                          }
                          className="flex h-11 w-11 items-center justify-center text-lg font-bold text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={t.cart.decreaseQuantity}
                        >
                          -
                        </button>

                        <span className="min-w-10 text-center text-sm font-bold text-[var(--ink)]">
                          {isUpdating ? "..." : item.quantity}
                        </span>

                        <button
                          type="button"
                          disabled={
                            (item.product.showStock &&
                              item.availableStock !== null &&
                              item.quantity >= item.availableStock) ||
                            item.quantity >= 99 ||
                            exceedsStock ||
                            isArchived ||
                            isOutOfStock ||
                            isUpdating ||
                            isRemoving
                          }
                          onClick={() =>
                            void updateQuantity(item.id, item.quantity + 1)
                          }
                          className="flex h-11 w-11 items-center justify-center text-lg font-bold text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={t.cart.increaseQuantity}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void removeItem(item.id)}
                        disabled={isRemoving || isUpdating}
                        className="min-h-11 rounded-full border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-2 text-start text-sm font-semibold text-[var(--danger-ink)] transition hover:bg-[var(--danger-soft)] focus-visible:ring-4 focus-visible:ring-[var(--danger-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRemoving ? t.cart.removing : t.cart.remove}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5 lg:sticky lg:top-24">
          <h2 className="text-xl font-black text-[var(--ink)]">
            {t.cart.orderSummary}
          </h2>

          <div className="mt-5 space-y-5 border-b border-[var(--line-soft)] pb-5">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {t.cart.deliveryDetailsTitle}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                {t.cart.deliveryDetailsDescription}
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-[var(--ink)]">
                {t.cart.deliveryArea}
              </legend>

              {DELIVERY_AREAS.map((area) => {
                const areaTranslation = t.delivery.areas[area.key];
                const isSelectedArea =
                  deliveryForm.deliveryAreaKey === area.key;

                return (
                  <label
                    key={area.key}
                    className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm transition ${
                      isSelectedArea
                        ? "border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--accent-strong)] shadow-sm"
                        : "border-[var(--line-soft)] bg-[var(--surface-card)] hover:border-[var(--line-soft)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryAreaKey"
                      value={area.key}
                      checked={deliveryForm.deliveryAreaKey === area.key}
                      onChange={() => updateDeliveryArea(area.key)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-[var(--ink)]">
                          {areaTranslation.label}
                        </span>
                        <span className="shrink-0 font-bold text-[var(--ink)]">
                          {formatDeliveryPriceNis(area.priceNis, {
                            free: t.delivery.free,
                            currency: t.delivery.currency,
                          })}
                        </span>
                      </span>
                      {areaTranslation.note ? (
                        <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">
                          {areaTranslation.note}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {selectedDeliveryArea.requiresCustomerAgreement &&
            selectedDeliveryTranslation.agreementLabel ? (
              <div>
                <label
                  className={`flex gap-3 rounded-2xl border p-3 text-sm font-medium transition ${
                    deliveryValidationAttempted &&
                    deliveryValidationErrors.pickupAgreement
                      ? "border-[var(--danger-ink)] bg-[var(--danger-soft)] text-[var(--danger-ink)]"
                      : "border-[var(--line-soft)] bg-[var(--surface-muted)] text-[var(--accent-strong)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={deliveryForm.pickupAgreementAccepted}
                    onChange={(event) =>
                      updateDeliveryForm(
                        "pickupAgreementAccepted",
                        event.target.checked,
                      )
                    }
                    className="mt-1 accent-[var(--accent)]"
                    aria-describedby={
                      deliveryValidationAttempted &&
                      deliveryValidationErrors.pickupAgreement
                        ? "pickup-agreement-error"
                        : undefined
                    }
                  />
                  <span>{selectedDeliveryTranslation.agreementLabel}</span>
                </label>

                {deliveryValidationAttempted &&
                deliveryValidationErrors.pickupAgreement ? (
                  <p
                    id="pickup-agreement-error"
                    className="mt-2 text-xs font-semibold text-[var(--danger-ink)]"
                  >
                    {deliveryValidationErrors.pickupAgreement}
                  </p>
                ) : null}
              </div>
            ) : null}

            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t.auth.phone}
              <input
                type="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => {
                  setPhoneInput(event.target.value);
                  setPhoneServerError(false);
                  setMessage("");
                }}
                aria-required="true"
                aria-invalid={
                  deliveryValidationAttempted &&
                  Boolean(deliveryValidationErrors.phone)
                }
                aria-describedby={
                  deliveryValidationAttempted && deliveryValidationErrors.phone
                    ? "checkout-phone-error"
                    : undefined
                }
                className={`mt-2 w-full rounded-2xl border bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] ${
                  deliveryValidationAttempted && deliveryValidationErrors.phone
                    ? "border-[var(--danger-ink)]"
                    : "border-[var(--line-soft)]"
                }`}
              />
              {deliveryValidationAttempted && deliveryValidationErrors.phone ? (
                <span
                  id="checkout-phone-error"
                  className="mt-2 block text-xs font-semibold text-[var(--danger-ink)]"
                >
                  {deliveryValidationErrors.phone}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t.cart.deliveryCity}
              <input
                type="text"
                value={deliveryForm.deliveryCity}
                onChange={(event) =>
                  updateDeliveryForm("deliveryCity", event.target.value)
                }
                placeholder={t.cart.deliveryCityPlaceholder}
                aria-invalid={
                  deliveryValidationAttempted &&
                  Boolean(deliveryValidationErrors.city)
                }
                aria-describedby={
                  deliveryValidationAttempted && deliveryValidationErrors.city
                    ? "delivery-city-error"
                    : undefined
                }
                className={`mt-2 w-full rounded-2xl border bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] ${
                  deliveryValidationAttempted && deliveryValidationErrors.city
                    ? "border-[var(--danger-ink)]"
                    : "border-[var(--line-soft)]"
                }`}
              />
              {deliveryValidationAttempted && deliveryValidationErrors.city ? (
                <span
                  id="delivery-city-error"
                  className="mt-2 block text-xs font-semibold text-[var(--danger-ink)]"
                >
                  {deliveryValidationErrors.city}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-semibold text-[var(--ink)]">
              {selectedDeliveryArea.requiresCustomerAgreement
                ? t.cart.deliveryAddressOptional
                : t.cart.deliveryAddress}
              <textarea
                value={deliveryForm.deliveryAddress}
                onChange={(event) =>
                  updateDeliveryForm("deliveryAddress", event.target.value)
                }
                placeholder={t.cart.deliveryAddressPlaceholder}
                rows={3}
                aria-invalid={
                  deliveryValidationAttempted &&
                  Boolean(deliveryValidationErrors.address)
                }
                aria-describedby={
                  deliveryValidationAttempted &&
                  deliveryValidationErrors.address
                    ? "delivery-address-error"
                    : undefined
                }
                className={`mt-2 w-full resize-none rounded-2xl border bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] ${
                  deliveryValidationAttempted &&
                  deliveryValidationErrors.address
                    ? "border-[var(--danger-ink)]"
                    : "border-[var(--line-soft)]"
                }`}
              />
              {deliveryValidationAttempted &&
              deliveryValidationErrors.address ? (
                <span
                  id="delivery-address-error"
                  className="mt-2 block text-xs font-semibold text-[var(--danger-ink)]"
                >
                  {deliveryValidationErrors.address}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t.cart.deliveryNotes}
              <textarea
                value={deliveryForm.deliveryNotes}
                onChange={(event) =>
                  updateDeliveryForm("deliveryNotes", event.target.value)
                }
                placeholder={t.cart.deliveryNotesPlaceholder}
                rows={2}
                className="mt-2 w-full resize-none rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </label>
          </div>

          <div className="mt-5 space-y-3 border-b border-[var(--line-soft)] pb-5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--ink-muted)]">{t.cart.items}</span>
              <span className="font-semibold text-[var(--ink)]">
                {itemCount}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--ink-muted)]">
                {t.cart.paymentMethod}
              </span>
              <span className="font-semibold text-[var(--ink)]">
                {t.cart.cashOnDelivery}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--ink-muted)]">
                {t.cart.productsTotal}
              </span>
              <span className="font-semibold text-[var(--ink)]">
                {formatPrice(total)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--ink-muted)]">
                {t.cart.deliveryPrice}
              </span>
              <span className="font-semibold text-[var(--ink)]">
                {formatDeliveryPriceNis(selectedDeliveryPrice, {
                  free: t.delivery.free,
                  currency: t.delivery.currency,
                })}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--ink-muted)]">
                {t.cart.estimatedTotal}
              </span>
              <span className="text-lg font-black text-[var(--accent-strong)]">
                {formatPrice(finalTotal)}
              </span>
            </div>
          </div>

          {submitAreaMessage ? (
            <div
              className="mt-5 rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-3 text-sm font-semibold text-[var(--danger-ink)]"
              role="alert"
            >
              {submitAreaMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={reviewOrder}
            disabled={
              checkoutStatus === "loading" ||
              checkoutStatus === "success" ||
              hasUnavailableItems
            }
            className="mt-5 w-full rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-[var(--surface-page)] shadow-sm shadow-black/10 transition hover:bg-[var(--accent-strong)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-muted)] disabled:shadow-none"
          >
            {checkoutStatus === "loading"
              ? t.cart.placingOrder
              : checkoutStatus === "success"
                ? t.cart.orderPlacedButton
                : t.cart.reviewOrder}
          </button>

          <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">
            {t.legal.notices.byPlacingOrder}{" "}
            <Link
              href="/terms"
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {t.legal.notices.termsOfUse}
            </Link>
            ,{" "}
            <Link
              href="/privacy"
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {t.legal.notices.privacyPolicy}
            </Link>
            ,{" "}
            <Link
              href="/shipping"
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {t.legal.notices.shippingPolicy}
            </Link>
            , {t.legal.notices.and}{" "}
            <Link
              href="/returns"
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {t.legal.notices.returnsPolicy}
            </Link>
            .
          </p>

          <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
            {t.cart.stockServerNote}
          </p>

          <Link
            href="/products"
            className="mt-4 inline-flex w-full justify-center rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-5 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
          >
            {t.cart.continueShopping}
          </Link>
        </aside>
      </div>

      {isConfirmingOrder ? (
        <dialog
          ref={confirmationRef}
          onCancel={() => setIsConfirmingOrder(false)}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = event.currentTarget.querySelectorAll<HTMLElement>(
              "a[href], button:not(:disabled)",
            );
            const first = controls.item(0);
            const last = controls.item(controls.length - 1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-order-title"
          className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 text-[var(--ink)] shadow-2xl shadow-black/20 backdrop:bg-[color-mix(in_srgb,var(--ink)_72%,transparent)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="confirm-order-title"
                className="text-2xl font-black text-[var(--ink)]"
              >
                {t.cart.confirmOrderTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                {t.cart.confirmOrderDescription}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsConfirmingOrder(false)}
              className="rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)]"
            >
              {t.cart.cancel}
            </button>
          </div>

          <div
            className="mt-6 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4"
            data-testid="checkout-review-items"
          >
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {t.cart.reviewItemsTitle}
            </h3>

            <ul className="mt-3 space-y-3">
              {cartItems.map((item) => {
                const variantLabel = formatVariantLabel(item.productVariant);
                const unitPrice = getEffectiveCartPrice(item.product);
                const lineTotal = unitPrice * item.quantity;

                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-3"
                  >
                    <p className="font-bold text-[var(--ink)]">
                      {item.product.name}
                    </p>

                    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      {variantLabel ? (
                        <div className="flex justify-between gap-3 sm:col-span-2">
                          <dt className="text-[var(--ink-muted)]">
                            {t.cart.selectedOption}
                          </dt>
                          <dd
                            className="text-end font-semibold text-[var(--ink)]"
                            data-testid="checkout-review-variant"
                          >
                            {variantLabel}
                          </dd>
                        </div>
                      ) : null}

                      <div className="flex justify-between gap-3">
                        <dt className="text-[var(--ink-muted)]">
                          {t.cart.quantity}
                        </dt>
                        <dd className="font-semibold text-[var(--ink)]">
                          {item.quantity}
                        </dd>
                      </div>

                      <div className="flex justify-between gap-3">
                        <dt className="text-[var(--ink-muted)]">
                          {t.cart.unitPrice}
                        </dt>
                        <dd className="font-semibold text-[var(--ink)]">
                          {formatPrice(unitPrice)}
                        </dd>
                      </div>

                      <div className="flex justify-between gap-3 sm:col-span-2">
                        <dt className="font-semibold text-[var(--ink)]">
                          {t.cart.lineTotal}
                        </dt>
                        <dd className="font-bold text-[var(--accent-strong)]">
                          {formatPrice(lineTotal)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4">
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {t.cart.contactInfo}
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.customerName}
                  </dt>
                  <dd className="text-end font-semibold text-[var(--ink)]">
                    {customer?.name?.trim() ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.customerEmail}
                  </dt>
                  <dd className="text-end font-semibold text-[var(--ink)]">
                    {customer?.email?.trim() ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.customerPhone}
                  </dt>
                  <dd className="text-end font-semibold text-[var(--ink)]">
                    {phone.trim() || "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
                {t.cart.savedAccountContact}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4">
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {t.cart.deliveryDetailsTitle}
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.deliveryArea}
                  </dt>
                  <dd className="text-end font-semibold text-[var(--ink)]">
                    {selectedDeliveryTranslation.label}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.deliveryMethod}
                  </dt>
                  <dd className="max-w-[65%] text-end font-semibold text-[var(--ink)]">
                    {t.delivery.method}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.estimatedDelivery}
                  </dt>
                  <dd className="max-w-[65%] text-end font-semibold text-[var(--ink)]">
                    {t.delivery.estimatedDuration}
                  </dd>
                </div>
                {selectedDeliveryTranslation.note ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--ink-muted)]">
                      {t.cart.deliveryConditions}
                    </dt>
                    <dd className="max-w-[65%] text-end font-semibold text-[var(--ink)]">
                      {selectedDeliveryTranslation.note}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.deliveryCity}
                  </dt>
                  <dd className="text-end font-semibold text-[var(--ink)]">
                    {deliveryForm.deliveryCity.trim()}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.deliveryAddress}
                  </dt>
                  <dd className="text-end font-semibold text-[var(--ink)]">
                    {deliveryForm.deliveryAddress.trim() || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.deliveryNotes}
                  </dt>
                  <dd className="text-end font-semibold text-[var(--ink)]">
                    {deliveryForm.deliveryNotes.trim() || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {t.cart.orderSummary}
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--ink-muted)]">
                  {t.cart.productsTotal}
                </dt>
                <dd className="font-semibold text-[var(--ink)]">
                  {formatPrice(total)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--ink-muted)]">
                  {t.cart.deliveryPrice}
                </dt>
                <dd className="font-semibold text-[var(--ink)]">
                  {formatDeliveryPriceNis(selectedDeliveryPrice, {
                    free: t.delivery.free,
                    currency: t.delivery.currency,
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--ink-muted)]">
                  {t.cart.paymentMethod}
                </dt>
                <dd className="font-semibold text-[var(--ink)]">
                  {t.cart.cashOnDelivery}
                </dd>
              </div>
              <div
                className="flex justify-between gap-4"
                data-testid="checkout-review-currency"
              >
                <dt className="text-[var(--ink-muted)]">{t.cart.currency}</dt>
                <dd className="font-semibold text-[var(--ink)]">
                  {t.delivery.currency}
                </dd>
              </div>
              {taxDisclosure ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--ink-muted)]">
                    {t.cart.taxInformation}
                  </dt>
                  <dd className="max-w-[65%] text-end font-semibold text-[var(--ink)]">
                    {taxDisclosure}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-[var(--line-soft)] pt-3">
                <dt className="font-bold text-[var(--ink)]">
                  {t.cart.finalTotal}
                </dt>
                <dd className="text-lg font-black text-[var(--accent-strong)]">
                  {formatPrice(finalTotal)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4 text-sm">
            <span className="text-[var(--ink-muted)]">
              {t.cart.complaintsHelp}{" "}
            </span>
            <Link
              href="/contact"
              className="font-bold text-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {t.cart.contactStore}
            </Link>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsConfirmingOrder(false)}
              className="rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-5 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
            >
              {t.cart.cancel}
            </button>

            <button
              type="button"
              onClick={() => void placeOrder()}
              disabled={checkoutStatus === "loading"}
              className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-muted)]"
            >
              {checkoutStatus === "loading"
                ? t.cart.placingOrder
                : t.cart.confirmPlaceOrder}
            </button>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
