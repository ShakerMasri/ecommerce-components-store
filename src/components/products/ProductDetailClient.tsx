"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddToCartControls } from "~/components/cart/AddToCartControls";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import {
  OptimizedImage,
  getOptimizedCloudinarySrc,
} from "~/components/ui/OptimizedImage";

type ProductVariant = {
  id: string;
  sizeLabel: string | null;
  colorLabel: string | null;
  stock: number | null;
  isInStock: boolean;
  sortOrder: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  discountPrice: string | null;
  stock: number | null;
  isInStock: boolean;
  showStock: boolean;
  images: string[];
  isFeatured: boolean;
  hasVariants: boolean;
  variants: ProductVariant[];
  createdAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
};

type ProductResponse = {
  product?: Product;
  message?: string;
};

type ProductDetailClientProps = {
  slug: string;
};

function formatPrice(price: string) {
  return `₪${Number(price).toFixed(2)}`;
}

function getDisplayPrice(product: Product) {
  return product.discountPrice ?? product.price;
}

function formatVariantLabel(variant: ProductVariant, fallback: string) {
  return (
    [variant.sizeLabel, variant.colorLabel].filter(Boolean).join(" / ") ||
    fallback
  );
}

export function ProductDetailClient({ slug }: ProductDetailClientProps) {
  const { t, language } = useAppPreferences();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProduct() {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(slug)}`,
          {
            signal: controller.signal,
          },
        );

        const data = (await response.json()) as ProductResponse;

        if (!response.ok || !data.product) {
          setProduct(null);
          setMessage(t.products.productNotFound);
          return;
        }

        setProduct(data.product);
        setSelectedImage(data.product.images.at(0) ?? null);
        setSelectedVariantId(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setProduct(null);
        setMessage(t.products.failedToConnect);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchProduct();

    return () => {
      controller.abort();
    };
  }, [slug, t.products.failedToConnect, t.products.productNotFound]);

  useEffect(() => {
    if (!product || !selectedImage || product.images.length < 2) {
      return;
    }

    const imagesToWarm = product.images
      .filter((image) => image !== selectedImage)
      .slice(0, 3);

    if (imagesToWarm.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      imagesToWarm.forEach((src) => {
        const image = new window.Image();
        image.decoding = "async";
        image.src = getOptimizedCloudinarySrc(src, 1400);
      });
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [product, selectedImage]);

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="aspect-square animate-pulse rounded-3xl bg-[var(--surface-muted)]" />

          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square animate-pulse rounded-2xl bg-[var(--surface-muted)]"
              />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-7 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-12 w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-[var(--ink)]">
          {t.products.productNotFound}
        </h1>

        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {message || t.products.productUnavailable}
        </p>

        <Link
          href="/products"
          className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)]"
        >
          {t.actions.backToProducts}
        </Link>
      </div>
    );
  }

  const selectedVariant = product.variants.find(
    (variant) => variant.id === selectedVariantId,
  );
  const selectedStock = selectedVariant?.stock ?? product.stock;
  const customerVisibleStock = product.showStock ? selectedStock : null;
  const selectedIsInStock = selectedVariant
    ? selectedVariant.isInStock
    : product.hasVariants
      ? false
      : product.isInStock;
  const isOutOfStock = !product.isInStock;
  const hasDiscount = product.discountPrice !== null;
  const selectedImageIndex = selectedImage
    ? product.images.findIndex((image) => image === selectedImage)
    : -1;
  const variantSelectionMessage = product.hasVariants
    ? t.products.selectOptionRequired
    : null;

  return (
    <section className="space-y-6">
      <div>
        <Link
          href="/products"
          className="text-sm font-semibold text-[var(--ink-muted)] transition hover:text-[var(--accent)]"
        >
          {language === "ar" ? "→" : "←"} {t.actions.backToProducts}
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-muted)] shadow-sm">
            {selectedImage ? (
              <OptimizedImage
                src={selectedImage}
                alt={product.name}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                cloudinaryWidth={1400}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--ink-muted)]">
                {t.products.noImage}
              </div>
            )}

            {product.isFeatured && (
              <span className="absolute top-4 left-4 rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-[var(--surface-page)]">
                {t.products.featured}
              </span>
            )}

            {isOutOfStock && (
              <span className="absolute top-4 right-4 rounded-full bg-[var(--danger-ink)] px-3 py-1 text-xs font-semibold text-[var(--surface-page)]">
                {t.products.soldOut}
              </span>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {product.images.map((image, index) => {
                const isActive = selectedImage === image;

                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className={`relative aspect-square overflow-hidden rounded-2xl border bg-[var(--surface-muted)] transition ${
                      isActive
                        ? "border-[var(--accent)] ring-4 ring-[var(--accent-soft)]"
                        : "border-[var(--line-soft)] hover:border-[var(--accent)]"
                    }`}
                    aria-label={`${t.products.image} ${index + 1}`}
                    aria-pressed={isActive}
                  >
                    <OptimizedImage
                      src={image}
                      alt={`${product.name} ${t.products.image} ${index + 1}`}
                      sizes="(max-width: 640px) 22vw, 96px"
                      loading={index < 4 ? "eager" : "lazy"}
                      cloudinaryWidth={220}
                      className="h-full w-full object-contain p-4"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {selectedImageIndex >= 0 && product.images.length > 1 && (
            <p className="text-center text-xs text-[var(--ink-muted)]">
              {t.products.image} {selectedImageIndex + 1} {t.products.of}{" "}
              {product.images.length}
            </p>
          )}
        </div>

        <div className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 shadow-sm shadow-black/5 sm:p-6 lg:sticky lg:top-24">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold tracking-wide text-[var(--accent)] uppercase">
                {product.category.name}
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight break-words text-[var(--ink)] sm:text-4xl">
                {product.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p
                  className={
                    hasDiscount
                      ? "text-3xl font-black text-[var(--sale-ink)]"
                      : "text-3xl font-black text-[var(--ink)]"
                  }
                >
                  {formatPrice(getDisplayPrice(product))}
                </p>

                {hasDiscount && (
                  <p className="text-sm font-semibold text-[var(--ink-muted)] line-through decoration-[var(--ink-muted)] decoration-solid decoration-2">
                    {formatPrice(product.price)}
                  </p>
                )}
              </div>

              {isOutOfStock ? (
                <span className="rounded-full border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-1 text-sm font-semibold text-[var(--danger-ink)]">
                  {t.products.outOfStock}
                </span>
              ) : (
                <span className="rounded-full border border-[var(--success-line)] bg-[var(--success-soft)] px-3 py-1 text-sm font-semibold text-[var(--success-ink)]">
                  {product.showStock &&
                  (selectedVariant ? selectedStock : product.stock) !== null
                    ? `${selectedVariant ? selectedStock : product.stock} ${t.products.left}`
                    : t.products.inStock}
                </span>
              )}
            </div>

            <div className="rounded-3xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--accent-soft)]">
              <h2 className="text-sm font-bold text-[var(--ink)]">
                {t.products.descriptionTitle}
              </h2>

              <p className="mt-2 text-sm leading-7 break-words whitespace-pre-line text-[var(--ink-muted)]">
                {product.description?.trim()
                  ? product.description
                  : t.products.noDescription}
              </p>
            </div>

            {product.hasVariants ? (
              <div className="rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--ink)]">
                      {t.products.options}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                      {t.products.selectOptionHelp}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {product.variants.map((variant) => {
                    const isSelected = selectedVariantId === variant.id;
                    const isVariantOutOfStock = !variant.isInStock;
                    const variantLabel = formatVariantLabel(
                      variant,
                      t.products.option,
                    );

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        disabled={isVariantOutOfStock}
                        className={`min-h-12 rounded-2xl border px-3 py-2.5 text-start transition focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--surface-card)] text-[var(--accent-strong)] shadow-sm ring-2 ring-[var(--accent-soft)]"
                            : isVariantOutOfStock
                              ? "border-[var(--line-soft)] bg-[var(--surface-muted)] text-[var(--ink-muted)]"
                              : "border-[var(--line-soft)] bg-[var(--surface-card)] text-[var(--ink)] hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-bold">
                            {variantLabel}
                          </span>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              isVariantOutOfStock
                                ? "border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger-ink)]"
                                : "border border-[var(--success-line)] bg-[var(--success-soft)] text-[var(--success-ink)]"
                            }`}
                          >
                            {isVariantOutOfStock
                              ? t.products.outOfStock
                              : product.showStock && variant.stock !== null
                                ? `${variant.stock} ${t.products.left}`
                                : t.products.inStock}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedVariant ? (
                  <p className="mt-3 rounded-2xl bg-[var(--surface-card)] px-3 py-2 text-xs leading-5 text-[var(--ink-muted)] ring-1 ring-[var(--accent-soft)]">
                    {t.products.selected}:{" "}
                    {formatVariantLabel(selectedVariant, t.products.option)}
                    {product.showStock && selectedVariant.stock !== null
                      ? ` · ${selectedVariant.stock} ${t.products.left}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-3 rounded-2xl bg-[var(--surface-card)] px-3 py-2 text-xs leading-5 font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--accent-soft)]">
                    {t.products.selectOptionRequired}
                  </p>
                )}
              </div>
            ) : null}

            <div className="border-t border-[var(--line-soft)] pt-5">
              <AddToCartControls
                productId={product.id}
                productVariantId={selectedVariant?.id ?? null}
                stock={customerVisibleStock}
                isInStock={selectedIsInStock}
                disabledReason={
                  product.hasVariants && !selectedVariant
                    ? variantSelectionMessage
                    : null
                }
              />

              <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
                {t.products.stockNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
