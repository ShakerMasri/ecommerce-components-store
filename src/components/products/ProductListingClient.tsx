"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { CategoryTabs } from "./CategoryTabs";
import { ProductCard } from "./ProductCard";
import { ProductCardSkeleton } from "./ProductCardSkeleton";

const PRODUCTS_PAGE_SIZE = 12;

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  price: string;
  discountPrice: string | null;
  stock: number | null;
  isInStock: boolean;
  showStock: boolean;
  images: string[];
  isFeatured: boolean;
  hasVariants: boolean;
  category: Category;
};

type ProductsPagination = {
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextPage: number | null;
};

type ProductsResponse = {
  products?: Product[];
  categories?: Category[];
  pagination?: ProductsPagination;
  message?: string;
};

type FetchMode = "replace" | "append";

function buildProductsUrl(options: {
  category: string | null;
  search: string;
  page: number;
}) {
  const searchParams = new URLSearchParams({
    page: String(options.page),
    pageSize: String(PRODUCTS_PAGE_SIZE),
  });
  const normalizedSearch = options.search.trim();

  if (options.category) {
    searchParams.set("category", options.category);
  }

  if (normalizedSearch) {
    searchParams.set("search", normalizedSearch);
  }

  return `/api/products?${searchParams.toString()}`;
}

export function ProductListingClient() {
  const { t } = useAppPreferences();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pagination, setPagination] = useState<ProductsPagination>({
    page: 1,
    pageSize: PRODUCTS_PAGE_SIZE,
    hasMore: false,
    nextPage: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchProducts = useCallback(
    async (page: number, mode: FetchMode, signal?: AbortSignal) => {
      if (mode === "replace") {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      setErrorMessage("");

      try {
        const response = await fetch(
          buildProductsUrl({
            category: selectedCategory,
            search: appliedSearch,
            page,
          }),
          { signal },
        );

        const data = (await response.json()) as ProductsResponse;

        if (!response.ok) {
          if (mode === "replace") {
            setProducts([]);
          }

          setErrorMessage(data.message ?? t.products.failedToLoad);
          return;
        }

        const nextProducts = data.products ?? [];

        setProducts((currentProducts) =>
          mode === "append"
            ? [...currentProducts, ...nextProducts]
            : nextProducts,
        );

        if (data.categories) {
          setCategories(data.categories);
        }

        if (data.pagination) {
          setPagination(data.pagination);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (mode === "replace") {
          setProducts([]);
        }

        setErrorMessage(t.products.failedToConnect);
      } finally {
        if (mode === "replace") {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [
      appliedSearch,
      selectedCategory,
      t.products.failedToConnect,
      t.products.failedToLoad,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchProducts(1, "replace", controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchProducts]);

  const selectedCategoryName =
    selectedCategory === null
      ? t.products.allProducts
      : (categories.find((category) => category.slug === selectedCategory)
          ?.name ?? t.products.selectedCategory);

  const hasActiveFilters =
    selectedCategory !== null || appliedSearch.trim() !== "";

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSearch = searchInput.trim();

    if (nextSearch === appliedSearch) {
      void fetchProducts(1, "replace");
      return;
    }

    setAppliedSearch(nextSearch);
  }

  return (
    <section className="space-y-5 sm:space-y-6">
      <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-[var(--accent)] uppercase">
              {t.products.badge}
            </p>

            <h1 className="mt-2 max-w-3xl text-2xl leading-tight font-bold tracking-[-0.035em] text-[var(--ink)] sm:mt-3 sm:text-4xl lg:text-5xl">
              {t.products.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)] sm:mt-3 sm:leading-7">
              {t.products.description}
            </p>
          </div>

          <form onSubmit={handleSearchSubmit}>
            <label
              htmlFor="product-search"
              className="text-xs font-semibold tracking-[0.2em] text-[var(--accent)] uppercase"
            >
              {t.products.searchLabel}
            </label>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="product-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t.products.searchPlaceholder}
                className="min-h-11 w-full rounded-full border border-[var(--line-soft)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--ink)] transition outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface-card)] sm:min-h-12"
              />

              <button
                type="submit"
                className="min-h-11 shrink-0 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12"
                disabled={isLoading || isLoadingMore}
              >
                {t.products.searchButton}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-[var(--line-soft)] bg-[var(--surface-card)] p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <CategoryTabs
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              allLabel={t.products.allProducts}
            />
          </div>

          <div className="shrink-0 text-sm">
            <p className="font-semibold text-[var(--ink)]">
              {selectedCategoryName}
            </p>

            {!isLoading && !errorMessage ? (
              <p className="mt-1 text-[var(--ink-muted)]">
                {t.products.showing} {products.length}{" "}
                {products.length === 1
                  ? t.products.productSingular
                  : t.products.productPlural}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-[var(--danger-ink)] bg-[var(--danger-soft)] p-5 text-sm font-semibold text-[var(--danger-ink)]">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : products.length === 0 && !errorMessage ? (
        <div className="rounded-[2rem] border border-dashed border-[var(--line-soft)] bg-[var(--surface-card)] p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {t.products.noProductsTitle}
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--ink-muted)]">
            {t.products.noProductsDescription}
          </p>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setSearchInput("");
                setAppliedSearch("");
              }}
              className="mt-6 min-h-11 rounded-full bg-[var(--ink)] px-6 py-2 text-sm font-semibold text-[var(--surface-page)] transition hover:bg-[var(--accent-strong)]"
            >
              {t.actions.clearFilters}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                labels={{
                  noImage: t.products.noImage,
                  featured: t.products.featured,
                  soldOut: t.products.soldOut,
                  out: t.products.out,
                  left: t.products.left,
                  inStock: t.products.inStock,
                  optionsAvailable: t.products.optionsAvailable,
                }}
              />
            ))}
          </div>

          {pagination.hasMore && pagination.nextPage !== null ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  if (pagination.nextPage !== null) {
                    void fetchProducts(pagination.nextPage, "append");
                  }
                }}
                className="min-h-11 rounded-full border border-[var(--ink)] bg-[var(--surface-card)] px-6 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--ink)] hover:text-[var(--surface-page)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12"
                disabled={isLoadingMore}
              >
                {isLoadingMore ? t.products.loadingMore : t.products.loadMore}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
