"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAX_CART_ITEM_QUANTITY } from "~/lib/cart";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";

type AddToCartControlsProps = {
  productId: string;
  productVariantId?: string | null;
  stock: number | null;
  isInStock: boolean;
  disabledReason?: string | null;
};

export function AddToCartControls({
  productId,
  productVariantId = null,
  stock,
  isInStock,
  disabledReason = null,
}: AddToCartControlsProps) {
  const router = useRouter();
  const { t } = useAppPreferences();

  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const maxClientQuantity = Math.min(
    stock ?? MAX_CART_ITEM_QUANTITY,
    MAX_CART_ITEM_QUANTITY,
  );
  const isOutOfStock = !isInStock;
  const isLoading = status === "loading";
  const isDisabled = isLoading || isOutOfStock || Boolean(disabledReason);

  useEffect(() => {
    setQuantity((currentQuantity) => {
      return Math.min(
        Math.max(1, currentQuantity),
        Math.max(1, maxClientQuantity),
      );
    });
  }, [maxClientQuantity, productVariantId]);

  function decreaseQuantity() {
    setQuantity((currentQuantity) => Math.max(1, currentQuantity - 1));
  }

  function increaseQuantity() {
    setQuantity((currentQuantity) =>
      Math.min(maxClientQuantity, currentQuantity + 1),
    );
  }

  async function handleAddToCart() {
    if (isDisabled) {
      if (disabledReason) {
        setStatus("error");
        setMessage(disabledReason);
      }

      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          productVariantId,
          quantity,
        }),
      });

      await response.json().catch(() => null);

      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/cart")}`);
        return;
      }

      if (!response.ok) {
        setStatus("error");
        setMessage(t.cart.failedToAddItem);
        return;
      }

      setStatus("success");
      setMessage(t.cart.itemAddedToCart);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage(t.cart.failedToConnect);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex w-fit items-center overflow-hidden rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] shadow-sm shadow-black/5">
          <button
            type="button"
            onClick={decreaseQuantity}
            disabled={isLoading || quantity <= 1}
            className="flex h-11 w-11 items-center justify-center text-lg font-bold text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t.cart.decreaseQuantity}
          >
            −
          </button>

          <span
            className="min-w-12 text-center text-sm font-black text-[var(--ink)]"
            aria-live="polite"
          >
            {quantity}
          </span>

          <button
            type="button"
            onClick={increaseQuantity}
            disabled={isLoading || quantity >= maxClientQuantity || isDisabled}
            className="flex h-11 w-11 items-center justify-center text-lg font-bold text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t.cart.increaseQuantity}
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isDisabled}
          className="min-h-11 flex-1 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-bold text-[var(--surface-page)] shadow-sm shadow-black/10 transition hover:bg-[var(--accent-strong)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-muted)] disabled:shadow-none"
        >
          {isLoading
            ? t.cart.addingToCart
            : disabledReason
              ? t.cart.chooseOption
              : isOutOfStock
                ? t.products.outOfStock
                : t.cart.addToCart}
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message ? (
          <p
            className={`rounded-2xl px-3 py-2 text-sm font-medium ${
              status === "error"
                ? "bg-[var(--danger-soft)] text-[var(--danger-ink)]"
                : "bg-[var(--success-soft)] text-[var(--success-ink)]"
            }`}
            role={status === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : (
          <p className="text-xs leading-5 text-[var(--ink-muted)]">
            {t.cart.quantityHelp}
          </p>
        )}

        <Link
          href="/cart"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--surface-muted)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
        >
          {t.actions.viewCart}
        </Link>
      </div>
    </div>
  );
}
