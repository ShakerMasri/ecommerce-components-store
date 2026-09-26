import Link from "next/link";
import { OptimizedImage } from "~/components/ui/OptimizedImage";

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    discountPrice: string | null;
    stock: number | null;
    isInStock?: boolean;
    showStock: boolean;
    images: string[];
    isFeatured?: boolean;
    hasVariants?: boolean;
    category: {
      id: string;
      name: string;
      slug: string;
    };
  };
  labels: {
    noImage: string;
    featured: string;
    soldOut: string;
    out: string;
    left: string;
    inStock: string;
    optionsAvailable: string;
  };
};

function formatPrice(price: string) {
  return `₪${Number(price)}`;
}

function getDisplayPrice(product: ProductCardProps["product"]) {
  return product.discountPrice ?? product.price;
}

export function ProductCard({ product, labels }: ProductCardProps) {
  const mainImage = product.images.at(0);
  const isOutOfStock =
    product.isInStock === undefined
      ? (product.stock ?? 0) <= 0
      : !product.isInStock;
  const shouldShowStockCount = product.showStock && product.stock !== null;
  const hasDiscount = product.discountPrice !== null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block h-full min-w-0"
      aria-label={product.name}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[var(--line-soft)] bg-[var(--surface-card)] shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-[var(--accent)] group-hover:shadow-xl group-hover:shadow-black/10">
        <div className="relative aspect-square overflow-hidden bg-[var(--surface-muted)]">
          {mainImage ? (
            <OptimizedImage
              src={mainImage}
              alt={product.name}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm font-medium text-[var(--ink-muted)]">
              {labels.noImage}
            </div>
          )}

          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            {product.isFeatured ? (
              <span className="rounded-full bg-[var(--surface-card)]/92 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--accent-strong)] uppercase shadow-sm backdrop-blur">
                {labels.featured}
              </span>
            ) : (
              <span />
            )}

            {isOutOfStock ? (
              <span className="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--danger-ink)] uppercase shadow-sm">
                {labels.soldOut}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3 sm:p-5">
          <div className="space-y-2">
            <p className="truncate text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase sm:text-[0.68rem]">
              {product.category.name}
            </p>

            <h3 className="min-h-10 text-sm leading-5 font-semibold break-words text-[var(--ink)] transition group-hover:text-[var(--accent-strong)] sm:min-h-12 sm:text-base sm:leading-6">
              {product.name}
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[0.64rem] font-semibold tracking-[0.12em] uppercase sm:px-3 sm:text-[0.68rem] ${
                isOutOfStock
                  ? "border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger-ink)]"
                  : "border border-[var(--success-line)] bg-[var(--success-soft)] text-[var(--success-ink)]"
              }`}
            >
              {isOutOfStock
                ? labels.out
                : shouldShowStockCount
                  ? `${product.stock} ${labels.left}`
                  : labels.inStock}
            </span>

            {product.hasVariants && !isOutOfStock ? (
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[0.64rem] font-semibold tracking-[0.12em] text-[var(--accent-strong)] uppercase sm:px-3 sm:text-[0.68rem]">
                {labels.optionsAvailable}
              </span>
            ) : null}
          </div>

          <div className="mt-auto min-h-[3.25rem] border-t border-[var(--line-soft)] pt-3">
            <p
              className={`text-lg font-bold tracking-tight sm:text-xl ${
                hasDiscount ? "text-[var(--sale-ink)]" : "text-[var(--ink)]"
              }`}
            >
              {formatPrice(getDisplayPrice(product))}
            </p>

            {hasDiscount ? (
              <p className="mt-0.5 text-sm font-semibold text-[var(--ink-muted)] line-through decoration-[var(--accent)] decoration-2">
                {formatPrice(product.price)}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
