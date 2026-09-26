"use client";

import Link from "next/link";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { OptimizedImage } from "~/components/ui/OptimizedImage";

type FieldErrors = Record<string, string[] | undefined>;

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ProductVariant = {
  id: string;
  productId: string;
  sizeLabel: string | null;
  colorLabel: string | null;
  sizeKey: string;
  colorKey: string;
  stock: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  discountPrice: string | null;
  stock: number;
  images: string[];
  isArchived: boolean;
  isFeatured: boolean;
  showStock: boolean;
  createdAt: string;
  updatedAt: string;
  category: Category;
  variants: ProductVariant[];
};

type ProductForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  discountPrice: string;
  stock: string;
  images: string[];
  isFeatured: boolean;
  showStock: boolean;
  categoryId: string;
};

type VariantForm = {
  sizeLabel: string;
  colorLabel: string;
  stock: string;
  isActive: boolean;
  sortOrder: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProductSummary = {
  activeProducts: number;
  archivedProducts: number;
};

type ProductFilters = {
  q: string;
  categoryId: string;
  status: "all" | "active" | "archived";
  stock: "all" | "in_stock" | "out_of_stock" | "low_stock";
  sort:
    | "newest"
    | "oldest"
    | "name_asc"
    | "name_desc"
    | "price_asc"
    | "price_desc"
    | "stock_asc"
    | "stock_desc";
};

type ProductsResponse = {
  products?: AdminProduct[];
  product?: AdminProduct;
  pagination?: Pagination;
  summary?: ProductSummary;
  message?: string;
  errors?: FieldErrors;
};

type CategoriesResponse = {
  categories?: Category[];
  category?: Category;
  pagination?: Pagination;
  message?: string;
  errors?: FieldErrors;
};

type UploadResponse = {
  message?: string;
  image?: {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  };
  errors?: FieldErrors;
};

type VariantResponse = {
  message?: string;
  variant?: ProductVariant;
  variants?: ProductVariant[];
  errors?: FieldErrors;
};

type MessageType = "success" | "error";
type MessageContext =
  | "create"
  | "edit"
  | `new:${string}`
  | `update:${string}`
  | `delete:${string}`
  | null;

const MAX_PRODUCT_IMAGE_SIZE_MB = 10;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = MAX_PRODUCT_IMAGE_SIZE_MB * 1024 * 1024;

const defaultProductFilters: ProductFilters = {
  q: "",
  categoryId: "",
  status: "all",
  stock: "all",
  sort: "newest",
};

const defaultPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

function buildProductsUrl(filters: ProductFilters, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(defaultPagination.limit),
    status: filters.status,
    stock: filters.stock,
    sort: filters.sort,
  });

  const search = filters.q.trim();

  if (search) {
    params.set("q", search);
  }

  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  return `/api/admin/products?${params.toString()}`;
}

function getEmptyProductForm(): ProductForm {
  return {
    name: "",
    slug: "",
    description: "",
    price: "",
    discountPrice: "",
    stock: "0",
    images: [],
    isFeatured: false,
    showStock: true,
    categoryId: "",
  };
}

function getEmptyVariantForm(): VariantForm {
  return {
    sizeLabel: "",
    colorLabel: "",
    stock: "0",
    isActive: true,
    sortOrder: "0",
  };
}

function variantToForm(variant: ProductVariant): VariantForm {
  return {
    sizeLabel: variant.sizeLabel ?? "",
    colorLabel: variant.colorLabel ?? "",
    stock: String(variant.stock),
    isActive: variant.isActive,
    sortOrder: String(variant.sortOrder),
  };
}

function formatPrice(price: string | number) {
  return `₪${Number(price).toFixed(2)}`;
}

function getDisplayPrice(
  product: Pick<AdminProduct, "price" | "discountPrice">,
) {
  return product.discountPrice ?? product.price;
}

function getActiveVariantStockTotal(product: Pick<AdminProduct, "variants">) {
  return product.variants
    .filter((variant) => variant.isActive)
    .reduce((total, variant) => total + variant.stock, 0);
}

function hasProductDiscount(
  product: Pick<AdminProduct, "discountPrice">,
): product is Pick<AdminProduct, "discountPrice"> & { discountPrice: string } {
  return product.discountPrice !== null;
}

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function prepareProductPayload(form: ProductForm) {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description.trim() ? form.description : null,
    price: form.price,
    discountPrice: form.discountPrice.trim() ? form.discountPrice : null,
    stock: form.stock,
    images: form.images,
    isFeatured: form.isFeatured,
    showStock: form.showStock,
    categoryId: form.categoryId,
  };
}

function prepareVariantPayload(form: VariantForm) {
  return {
    sizeLabel: form.sizeLabel,
    colorLabel: form.colorLabel,
    stock: form.stock,
    isActive: form.isActive,
    sortOrder: form.sortOrder,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1 text-sm font-medium text-[var(--danger-ink)]">
      {message}
    </p>
  );
}

function InlineFeedback({
  message,
  type,
}: {
  message: string;
  type: MessageType;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-sm font-semibold ${
        type === "success"
          ? "border-[var(--success-line)] bg-[var(--success-soft)] text-[var(--success-ink)]"
          : "border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger-ink)]"
      }`}
    >
      {message}
    </div>
  );
}

type ProductFieldErrorLabels = {
  checkHighlightedFields: string;
  invalidProductName: string;
  invalidProductSlug: string;
  productSlugAlreadyUsed: string;
  invalidDescription: string;
  invalidPrice: string;
  invalidDiscountPrice: string;
  invalidCategory: string;
  invalidImage: string;
  invalidOptionSizeOrColor: string;
  invalidOptionStock: string;
  invalidOptionSortOrder: string;
};

function getLocalizedFieldError(
  field: string,
  messages: string[] | undefined,
  labels: ProductFieldErrorLabels,
) {
  const firstMessage = messages?.[0]?.toLowerCase() ?? "";

  if (field === "slug" && firstMessage.includes("already")) {
    return labels.productSlugAlreadyUsed;
  }

  switch (field) {
    case "_form":
      return labels.checkHighlightedFields;
    case "name":
      return labels.invalidProductName;
    case "slug":
      return labels.invalidProductSlug;
    case "description":
      return labels.invalidDescription;
    case "price":
      return labels.invalidPrice;
    case "discountPrice":
      return labels.invalidDiscountPrice;
    case "categoryId":
      return labels.invalidCategory;
    case "images":
    case "file":
      return labels.invalidImage;
    case "sizeLabel":
    case "colorLabel":
      return labels.invalidOptionSizeOrColor;
    case "stock":
      return labels.invalidOptionStock;
    case "sortOrder":
      return labels.invalidOptionSortOrder;
    default:
      return labels.checkHighlightedFields;
  }
}

function getLocalizedFieldErrors(
  errors: FieldErrors,
  labels: ProductFieldErrorLabels,
): FieldErrors {
  return Object.entries(errors).reduce<FieldErrors>(
    (localizedErrors, [field, messages]) => {
      const normalizedField = field === "file" ? "images" : field;

      localizedErrors[normalizedField] = [
        getLocalizedFieldError(field, messages, labels),
      ];

      return localizedErrors;
    },
    {},
  );
}

type ProductFormLabels = {
  productName: string;
  productNamePlaceholder: string;
  slug: string;
  slugPlaceholder: string;
  make: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  price: string;
  discountPrice: string;
  discountPricePlaceholder: string;
  discountPriceHelp: string;
  category: string;
  selectCategory: string;
  featuredProduct: string;
  showStockOnStore: string;
  showStockHelp: string;
  stockHidden: string;
  images: string;
  imageUrlPlaceholder: string;
  addUrl: string;
  imageHelp: string;
  imageTooLarge: string;
  productPreview: string;
  remove: string;
  checkHighlightedFields: string;
  invalidProductName: string;
  invalidProductSlug: string;
  productSlugAlreadyUsed: string;
  invalidDescription: string;
  invalidPrice: string;
  invalidDiscountPrice: string;
  invalidCategory: string;
  invalidImage: string;
  invalidOptionSizeOrColor: string;
  invalidOptionStock: string;
  invalidOptionSortOrder: string;
};

type ProductFormFieldsProps = {
  form: ProductForm;
  setForm: Dispatch<SetStateAction<ProductForm>>;
  categories: Category[];
  errors: FieldErrors;
  imageUrl: string;
  setImageUrl: Dispatch<SetStateAction<string>>;
  onAddImageUrl: () => void;
  onRemoveImage: (image: string) => void;
  onUpload: (file: File) => void;
  isUploading: boolean;
  labels: ProductFormLabels;
};

function ProductFormFields({
  form,
  setForm,
  categories,
  errors,
  imageUrl,
  setImageUrl,
  onAddImageUrl,
  onRemoveImage,
  onUpload,
  isUploading,
  labels,
}: ProductFormFieldsProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onUpload(file);
    event.target.value = "";
  }

  return (
    <div className="grid gap-5">
      {errors._form?.[0] && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {labels.productName}
          </label>

          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
            placeholder={labels.productNamePlaceholder}
          />

          <FieldError message={errors.name?.[0]} />
        </div>

        <div>
          <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {labels.slug}
          </label>

          <div className="mt-2 flex gap-2">
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  slug: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
              placeholder={labels.slugPlaceholder}
            />

            <button
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  slug: makeSlug(current.name),
                }))
              }
              className="shrink-0 rounded-2xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              {labels.make}
            </button>
          </div>

          <FieldError message={errors.slug?.[0]} />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {labels.descriptionLabel}
        </label>

        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
          placeholder={labels.descriptionPlaceholder}
        />

        <FieldError message={errors.description?.[0]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {labels.price}
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                price: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
            placeholder="19.99"
          />

          <FieldError message={errors.price?.[0]} />
        </div>

        <div>
          <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {labels.discountPrice}
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={form.discountPrice}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                discountPrice: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
            placeholder={labels.discountPricePlaceholder}
          />

          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {labels.discountPriceHelp}
          </p>

          <FieldError message={errors.discountPrice?.[0]} />
        </div>

        <div>
          <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {labels.category}
          </label>

          <select
            value={form.categoryId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                categoryId: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
          >
            <option value="">{labels.selectCategory}</option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <FieldError message={errors.categoryId?.[0]} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isFeatured: event.target.checked,
              }))
            }
            className="h-4 w-4"
          />
          {labels.featuredProduct}
        </label>

        <label className="rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
          <span className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.showStock}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  showStock: event.target.checked,
                }))
              }
              className="h-4 w-4"
            />
            {labels.showStockOnStore}
          </span>

          <span className="mt-2 block text-xs leading-5 font-medium text-zinc-500 dark:text-zinc-400">
            {labels.showStockHelp}
          </span>
        </label>
      </div>

      <div>
        <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {labels.images}
        </label>

        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
            placeholder={labels.imageUrlPlaceholder}
          />

          <button
            type="button"
            onClick={onAddImageUrl}
            className="rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {labels.addUrl}
          </button>
        </div>

        <div className="mt-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800 disabled:opacity-60 dark:text-zinc-400 dark:file:bg-white dark:file:text-zinc-950"
          />

          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {labels.imageHelp}
          </p>
        </div>

        <FieldError message={errors.images?.[0]} />

        {form.images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {form.images.map((image) => (
              <div
                key={image}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
                  {" "}
                  <OptimizedImage
                    src={image}
                    alt={labels.productPreview}
                    sizes="160px"
                    className="object-contain p-1"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveImage(image)}
                  className="w-full px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {labels.remove}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ProductOptionLabels = {
  optionsTitle: string;
  optionsDescription: string;
  optionCount: string;
  optionsCountLabel: string;
  optionsCountHelp: string;
  activeOptionStock: string;
  activeOptionStockHelp: string;
  size: string;
  color: string;
  stock: string;
  sortOrder: string;
  active: string;
  saveOption: string;
  savingOption: string;
  makeInactive: string;
  makingInactive: string;
  addOption: string;
  addingOption: string;
  sizePlaceholder: string;
  colorPlaceholder: string;
  checkHighlightedFields: string;
  invalidProductName: string;
  invalidProductSlug: string;
  productSlugAlreadyUsed: string;
  invalidDescription: string;
  invalidPrice: string;
  invalidDiscountPrice: string;
  invalidCategory: string;
  invalidImage: string;
  invalidOptionSizeOrColor: string;
  invalidOptionStock: string;
  invalidOptionSortOrder: string;
};

type VariantManagementSectionProps = {
  product: AdminProduct;
  labels: ProductOptionLabels;
  variantDraft: VariantForm;
  variantEditDrafts: Record<string, VariantForm>;
  updatingVariantKey: string | null;
  errors: FieldErrors;
  message: string;
  messageType: MessageType;
  messageContext: MessageContext;
  onUpdateVariantDraft: (
    productId: string,
    field: keyof VariantForm,
    value: string | boolean,
  ) => void;
  onUpdateVariantEditDraft: (
    variantId: string,
    field: keyof VariantForm,
    value: string | boolean,
  ) => void;
  onCreateVariant: (productId: string) => void;
  onUpdateVariant: (productId: string, variantId: string) => void;
  onDeactivateVariant: (productId: string, variantId: string) => void;
};

function VariantManagementSection({
  product,
  labels,
  variantDraft,
  variantEditDrafts,
  updatingVariantKey,
  errors,
  message,
  messageType,
  messageContext,
  onUpdateVariantDraft,
  onUpdateVariantEditDraft,
  onCreateVariant,
  onUpdateVariant,
  onDeactivateVariant,
}: VariantManagementSectionProps) {
  const activeVariantStockTotal = getActiveVariantStockTotal(product);
  const isCreatingVariant = updatingVariantKey === `new:${product.id}`;
  const createVariantContext: MessageContext = `new:${product.id}`;
  const showCreateVariantErrors = messageContext === createVariantContext;

  return (
    <section className="mt-6 rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-[var(--ink)]">
            {labels.optionsTitle}
          </h3>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            {labels.optionsDescription}
          </p>
        </div>

        <span className="w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
          {labels.optionCount.replace(
            "{count}",
            String(product.variants.length),
          )}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--ink-muted)] uppercase">
            {labels.optionsCountLabel}
          </p>
          <p className="mt-2 text-2xl font-black text-[var(--ink)]">
            {product.variants.length}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
            {labels.optionsCountHelp}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--ink-muted)] uppercase">
            {labels.activeOptionStock}
          </p>
          <p className="mt-2 text-2xl font-black text-[var(--ink)]">
            {activeVariantStockTotal}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
            {labels.activeOptionStockHelp}
          </p>
        </div>
      </div>

      {showCreateVariantErrors && message && (
        <div className="mt-4">
          <InlineFeedback message={message} type={messageType} />
        </div>
      )}

      {product.variants.length > 0 && (
        <div className="mt-4 space-y-3">
          {product.variants.map((variant) => {
            const draft =
              variantEditDrafts[variant.id] ?? variantToForm(variant);
            const updateVariantContext: MessageContext = `update:${variant.id}`;
            const deleteVariantContext: MessageContext = `delete:${variant.id}`;
            const isSavingVariant = updatingVariantKey === updateVariantContext;
            const isDeactivatingVariant =
              updatingVariantKey === deleteVariantContext;
            const showVariantErrors =
              messageContext === updateVariantContext ||
              messageContext === deleteVariantContext;

            return (
              <div
                key={variant.id}
                className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-elevated)] p-3"
              >
                {showVariantErrors && message && (
                  <div className="mb-3">
                    <InlineFeedback message={message} type={messageType} />
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="text-xs font-semibold text-[var(--ink)]">
                      {labels.size}
                    </label>
                    <input
                      value={draft.sizeLabel}
                      onChange={(event) =>
                        onUpdateVariantEditDraft(
                          variant.id,
                          "sizeLabel",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                      placeholder="M"
                    />
                    {showVariantErrors && (
                      <FieldError message={errors.sizeLabel?.[0]} />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--ink)]">
                      {labels.color}
                    </label>
                    <input
                      value={draft.colorLabel}
                      onChange={(event) =>
                        onUpdateVariantEditDraft(
                          variant.id,
                          "colorLabel",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                      placeholder="Black"
                    />
                    {showVariantErrors && (
                      <FieldError message={errors.colorLabel?.[0]} />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--ink)]">
                      {labels.stock}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.stock}
                      onChange={(event) =>
                        onUpdateVariantEditDraft(
                          variant.id,
                          "stock",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                    />
                    {showVariantErrors && (
                      <FieldError message={errors.stock?.[0]} />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--ink)]">
                      {labels.sortOrder}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.sortOrder}
                      onChange={(event) =>
                        onUpdateVariantEditDraft(
                          variant.id,
                          "sortOrder",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                    />
                    {showVariantErrors && (
                      <FieldError message={errors.sortOrder?.[0]} />
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        onUpdateVariantEditDraft(
                          variant.id,
                          "isActive",
                          event.target.checked,
                        )
                      }
                    />
                    {labels.active}
                  </label>

                  <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <button
                      type="button"
                      disabled={isSavingVariant}
                      onClick={() => onUpdateVariant(product.id, variant.id)}
                      className="workspace-primary-action rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingVariant
                        ? labels.savingOption
                        : labels.saveOption}
                    </button>

                    {variant.isActive && (
                      <button
                        type="button"
                        disabled={isDeactivatingVariant}
                        onClick={() =>
                          onDeactivateVariant(product.id, variant.id)
                        }
                        className="rounded-full border border-[var(--danger-ink)] px-4 py-2 text-sm font-semibold text-[var(--danger-ink)] transition hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeactivatingVariant
                          ? labels.makingInactive
                          : labels.makeInactive}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-elevated)] p-3">
        <h4 className="text-sm font-black text-[var(--ink)]">
          {labels.addOption}
        </h4>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div>
            <label className="text-xs font-semibold text-[var(--ink)]">
              {labels.size}
            </label>
            <input
              value={variantDraft.sizeLabel}
              onChange={(event) =>
                onUpdateVariantDraft(
                  product.id,
                  "sizeLabel",
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder={labels.sizePlaceholder}
            />
            {showCreateVariantErrors && (
              <FieldError message={errors.sizeLabel?.[0]} />
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--ink)]">
              {labels.color}
            </label>
            <input
              value={variantDraft.colorLabel}
              onChange={(event) =>
                onUpdateVariantDraft(
                  product.id,
                  "colorLabel",
                  event.target.value,
                )
              }
              className="mt-1 w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder={labels.colorPlaceholder}
            />
            {showCreateVariantErrors && (
              <FieldError message={errors.colorLabel?.[0]} />
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--ink)]">
              {labels.stock}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={variantDraft.stock}
              onChange={(event) =>
                onUpdateVariantDraft(product.id, "stock", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--ink)] transition outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="0"
            />
            {showCreateVariantErrors && (
              <FieldError message={errors.stock?.[0]} />
            )}
          </div>

          <button
            type="button"
            disabled={isCreatingVariant}
            onClick={() => onCreateVariant(product.id)}
            className="workspace-primary-action rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingVariant ? labels.addingOption : labels.addOption}
          </button>
        </div>
      </div>
    </section>
  );
}

export function AdminProductsClient() {
  const { t } = useAppPreferences();
  const labels = t.admin.products;

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productFilters, setProductFilters] = useState<ProductFilters>(
    defaultProductFilters,
  );
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] =
    useState<Pagination>(defaultPagination);
  const [productSummary, setProductSummary] = useState<ProductSummary>({
    activeProducts: 0,
    archivedProducts: 0,
  });

  const [createForm, setCreateForm] = useState<ProductForm>(() =>
    getEmptyProductForm(),
  );
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductForm | null>(null);
  const editFormRef = useRef<HTMLFormElement | null>(null);
  const [pendingEditScrollId, setPendingEditScrollId] = useState<string | null>(
    null,
  );

  const [createImageUrl, setCreateImageUrl] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  const [variantDrafts, setVariantDrafts] = useState<
    Record<string, VariantForm>
  >({});
  const [variantEditDrafts, setVariantEditDrafts] = useState<
    Record<string, VariantForm>
  >({});

  const [productErrors, setProductErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("success");
  const [messageContext, setMessageContext] = useState<MessageContext>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(
    null,
  );
  const [updatingVariantKey, setUpdatingVariantKey] = useState<string | null>(
    null,
  );
  const [uploadingMode, setUploadingMode] = useState<"create" | "edit" | null>(
    null,
  );

  function showMessage(
    type: MessageType,
    value: string,
    context: MessageContext = null,
  ) {
    setMessageType(type);
    setMessage(value);
    setMessageContext(context);
  }

  function clearFeedback() {
    setMessage("");
    setMessageContext(null);
  }

  function setLocalizedProductErrors(errors: FieldErrors) {
    setProductErrors(getLocalizedFieldErrors(errors, labels));
  }

  function setEditProductForm(nextForm: SetStateAction<ProductForm>) {
    setEditForm((current) => {
      if (!current) {
        return current;
      }

      return typeof nextForm === "function" ? nextForm(current) : nextForm;
    });
  }

  async function loadAdminData(page = productPage, filters = productFilters) {
    setIsLoading(true);
    setProductErrors({});

    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch(buildProductsUrl(filters, page)),
        fetch("/api/admin/categories?limit=50&sort=name_asc"),
      ]);

      const [productsData, categoriesData] = (await Promise.all([
        productsResponse.json(),
        categoriesResponse.json(),
      ])) as [ProductsResponse, CategoriesResponse];

      if (!productsResponse.ok) {
        showMessage("error", labels.failedToLoadProducts);
        setProducts([]);
        setProductPagination(defaultPagination);
        return;
      }

      if (!categoriesResponse.ok) {
        showMessage("error", labels.failedToLoadCategories);
        setCategories([]);
        return;
      }

      const nextProducts = productsData.products ?? [];

      setProducts(nextProducts);
      setProductPage(productsData.pagination?.page ?? page);
      setProductPagination(productsData.pagination ?? defaultPagination);
      setProductSummary(
        productsData.summary ?? { activeProducts: 0, archivedProducts: 0 },
      );
      setCategories(categoriesData.categories ?? []);
      setVariantDrafts(
        Object.fromEntries(
          nextProducts.map((product) => [product.id, getEmptyVariantForm()]),
        ),
      );
      setVariantEditDrafts(
        Object.fromEntries(
          nextProducts.flatMap((product) =>
            product.variants.map((variant) => [
              variant.id,
              variantToForm(variant),
            ]),
          ),
        ),
      );
    } catch {
      showMessage("error", labels.failedToConnect);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
    // Load once on mount. Language changes only affect labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      !pendingEditScrollId ||
      pendingEditScrollId !== editProductId ||
      !editForm
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      editFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingEditScrollId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editForm, editProductId, pendingEditScrollId]);

  function addCreateImageUrl() {
    const nextUrl = createImageUrl.trim();

    if (!nextUrl) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      images: [...current.images, nextUrl],
    }));
    setCreateImageUrl("");
  }

  function addEditImageUrl() {
    const nextUrl = editImageUrl.trim();

    if (!nextUrl || !editForm) {
      return;
    }

    setEditForm((current) =>
      current
        ? {
            ...current,
            images: [...current.images, nextUrl],
          }
        : current,
    );
    setEditImageUrl("");
  }

  function removeCreateImage(image: string) {
    setCreateForm((current) => ({
      ...current,
      images: current.images.filter((currentImage) => currentImage !== image),
    }));
  }

  function removeEditImage(image: string) {
    setEditForm((current) =>
      current
        ? {
            ...current,
            images: current.images.filter(
              (currentImage) => currentImage !== image,
            ),
          }
        : current,
    );
  }

  async function uploadImage(file: File, target: "create" | "edit") {
    setProductErrors({});
    clearFeedback();

    if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      const message = labels.imageTooLarge.replace(
        "{size}",
        String(MAX_PRODUCT_IMAGE_SIZE_MB),
      );

      setProductErrors({ images: [message] });
      showMessage("error", message, target);
      return;
    }

    setUploadingMode(target);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/uploads/product-images", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse;

      if (!response.ok || !data.image) {
        setLocalizedProductErrors(
          data.errors && Object.keys(data.errors).length > 0
            ? data.errors
            : { images: [labels.invalidImage] },
        );
        showMessage("error", labels.failedToUploadImage, target);
        return;
      }

      const uploadedUrl = data.image.url;

      if (target === "create") {
        setCreateForm((current) => ({
          ...current,
          images: [...current.images, uploadedUrl],
        }));
      } else {
        setEditForm((current) =>
          current
            ? {
                ...current,
                images: [...current.images, uploadedUrl],
              }
            : current,
        );
      }

      showMessage("success", labels.imageUploaded, target);
    } catch {
      showMessage("error", labels.failedToConnect, target);
    } finally {
      setUploadingMode(null);
    }
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSavingProduct(true);
    setProductErrors({});
    clearFeedback();

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prepareProductPayload(createForm)),
      });

      const data = (await response.json()) as ProductsResponse;

      if (!response.ok) {
        setLocalizedProductErrors(data.errors ?? {});
        showMessage("error", labels.failedToCreateProduct, "create");
        return;
      }

      setCreateForm(getEmptyProductForm());
      setCreateImageUrl("");
      setIsCreateFormOpen(false);
      showMessage("success", labels.productCreated, "create");
      await loadAdminData(productPage, productFilters);
    } catch {
      showMessage("error", labels.failedToConnect, "create");
    } finally {
      setIsSavingProduct(false);
    }
  }

  function startEditingProduct(product: AdminProduct) {
    setProductErrors({});
    clearFeedback();
    setEditProductId(product.id);
    setPendingEditScrollId(product.id);
    setEditImageUrl("");

    setEditForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      price: product.price,
      discountPrice: product.discountPrice ?? "",
      stock: String(product.stock),
      images: product.images,
      isFeatured: product.isFeatured,
      showStock: product.showStock,
      categoryId: product.category.id,
    });
  }

  function cancelEditingProduct() {
    setEditProductId(null);
    setEditForm(null);
    setPendingEditScrollId(null);
    setEditImageUrl("");
    setProductErrors({});
  }

  async function handleUpdateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editProductId || !editForm) {
      return;
    }

    setIsSavingProduct(true);
    setProductErrors({});
    clearFeedback();

    try {
      const response = await fetch(`/api/admin/products/${editProductId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prepareProductPayload(editForm)),
      });

      const data = (await response.json()) as ProductsResponse;

      if (!response.ok) {
        setLocalizedProductErrors(data.errors ?? {});
        showMessage("error", labels.failedToUpdateProduct, "edit");
        return;
      }

      showMessage("success", labels.productUpdated, "edit");
      cancelEditingProduct();
      await loadAdminData(productPage, productFilters);
    } catch {
      showMessage("error", labels.failedToConnect, "edit");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function archiveProduct(productId: string) {
    setUpdatingProductId(productId);
    clearFeedback();

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });

      await response.json().catch(() => null);

      if (!response.ok) {
        showMessage("error", labels.failedToArchiveProduct);
        return;
      }

      showMessage("success", labels.productArchived);
      await loadAdminData(productPage, productFilters);
    } catch {
      showMessage("error", labels.failedToConnect);
    } finally {
      setUpdatingProductId(null);
    }
  }

  async function restoreProduct(productId: string) {
    setUpdatingProductId(productId);
    clearFeedback();

    try {
      const response = await fetch(`/api/admin/products/${productId}/restore`, {
        method: "POST",
      });

      await response.json().catch(() => null);

      if (!response.ok) {
        showMessage("error", labels.failedToRestoreProduct);
        return;
      }

      showMessage("success", labels.productRestored);
      await loadAdminData(productPage, productFilters);
    } catch {
      showMessage("error", labels.failedToConnect);
    } finally {
      setUpdatingProductId(null);
    }
  }

  function updateVariantDraft(
    productId: string,
    field: keyof VariantForm,
    value: string | boolean,
  ) {
    setVariantDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? getEmptyVariantForm()),
        [field]: value,
      },
    }));
  }

  function updateVariantEditDraft(
    variantId: string,
    field: keyof VariantForm,
    value: string | boolean,
  ) {
    setVariantEditDrafts((current) => ({
      ...current,
      [variantId]: {
        ...(current[variantId] ?? getEmptyVariantForm()),
        [field]: value,
      },
    }));
  }

  async function createVariant(productId: string) {
    const draft = variantDrafts[productId] ?? getEmptyVariantForm();
    const variantKey: MessageContext = `new:${productId}`;

    setUpdatingVariantKey(variantKey);
    setProductErrors({});
    clearFeedback();

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/variants`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(prepareVariantPayload(draft)),
        },
      );

      const data = (await response.json()) as VariantResponse;

      if (!response.ok) {
        setLocalizedProductErrors(data.errors ?? {});
        showMessage("error", labels.failedToCreateOption, variantKey);
        return;
      }

      showMessage("success", labels.optionCreated, variantKey);
      setVariantDrafts((current) => ({
        ...current,
        [productId]: getEmptyVariantForm(),
      }));
      await loadAdminData(productPage, productFilters);
    } catch {
      showMessage("error", labels.failedToConnect, variantKey);
    } finally {
      setUpdatingVariantKey(null);
    }
  }

  async function updateVariant(productId: string, variantId: string) {
    const draft = variantEditDrafts[variantId];

    if (!draft) {
      return;
    }

    const variantKey: MessageContext = `update:${variantId}`;

    setUpdatingVariantKey(variantKey);
    setProductErrors({});
    clearFeedback();

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/variants/${variantId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(prepareVariantPayload(draft)),
        },
      );

      const data = (await response.json()) as VariantResponse;

      if (!response.ok) {
        setLocalizedProductErrors(data.errors ?? {});
        showMessage("error", labels.failedToUpdateOption, variantKey);
        return;
      }

      showMessage("success", labels.optionUpdated, variantKey);
      await loadAdminData(productPage, productFilters);
    } catch {
      showMessage("error", labels.failedToConnect, variantKey);
    } finally {
      setUpdatingVariantKey(null);
    }
  }

  async function deactivateVariant(productId: string, variantId: string) {
    const variantKey: MessageContext = `delete:${variantId}`;

    setUpdatingVariantKey(variantKey);
    setProductErrors({});
    clearFeedback();

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/variants/${variantId}`,
        {
          method: "DELETE",
        },
      );

      await response.json().catch(() => null);

      if (!response.ok) {
        showMessage("error", labels.failedToDeactivateOption, variantKey);
        return;
      }

      showMessage("success", labels.optionDeactivated, variantKey);
      await loadAdminData(productPage, productFilters);
    } catch {
      showMessage("error", labels.failedToConnect, variantKey);
    } finally {
      setUpdatingVariantKey(null);
    }
  }

  function handleApplyProductFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductPage(1);
    void loadAdminData(1, productFilters);
  }

  function clearProductFilters() {
    setProductFilters(defaultProductFilters);
    setProductPage(1);
    void loadAdminData(1, defaultProductFilters);
  }

  function goToProductPage(page: number) {
    const nextPage = Math.min(
      Math.max(page, 1),
      Math.max(productPagination.totalPages, 1),
    );

    setProductPage(nextPage);
    void loadAdminData(nextPage, productFilters);
  }

  const selectedEditProduct = editProductId
    ? (products.find((product) => product.id === editProductId) ?? null)
    : null;

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
        </div>

        <div className="h-96 animate-pulse rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-orange-600 uppercase dark:text-orange-400">
            {labels.badge}
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
            {labels.title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {labels.description}
          </p>
        </div>

        <Link
          href="/admin"
          className="w-fit rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-950"
        >
          {labels.backToDashboard}
        </Link>
      </div>

      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm font-medium ${
            messageType === "success"
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {labels.activeProducts}
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-white">
            {productSummary.activeProducts}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {labels.archivedProducts}
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-white">
            {productSummary.archivedProducts}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {labels.categories}
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-white">
            {categories.length}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <h2 className="text-xl font-black text-zinc-950 dark:text-white">
              {labels.createProduct}
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {labels.createProductDescription}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
            <button
              type="button"
              onClick={() => setIsCreateFormOpen((current) => !current)}
              className="workspace-primary-action rounded-full px-5 py-2.5 text-sm font-semibold transition"
            >
              {isCreateFormOpen ? labels.hideCreateProduct : labels.addProduct}
            </button>

            <Link
              href="/admin/categories"
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-950"
            >
              {labels.manageCategories}
            </Link>
          </div>
        </div>

        {isCreateFormOpen && (
          <form
            onSubmit={handleCreateProduct}
            className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-xl font-black text-zinc-950 dark:text-white">
              {labels.createProduct}
            </h2>

            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {labels.createProductDescription}
            </p>

            {messageContext === "create" && message && (
              <div className="mt-5">
                <InlineFeedback message={message} type={messageType} />
              </div>
            )}

            <div className="mt-6">
              <ProductFormFields
                form={createForm}
                setForm={setCreateForm}
                categories={categories}
                errors={productErrors}
                imageUrl={createImageUrl}
                setImageUrl={setCreateImageUrl}
                onAddImageUrl={addCreateImageUrl}
                onRemoveImage={removeCreateImage}
                onUpload={(file) => void uploadImage(file, "create")}
                isUploading={uploadingMode === "create"}
                labels={labels}
              />
            </div>

            <button
              type="submit"
              disabled={isSavingProduct}
              className="workspace-primary-action mt-6 w-full rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProduct ? labels.creating : labels.createProductButton}
            </button>
          </form>
        )}

        {editForm && editProductId && (
          <form
            ref={editFormRef}
            onSubmit={handleUpdateProduct}
            className="scroll-mt-24 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm sm:p-6 dark:border-orange-900 dark:bg-orange-950"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-zinc-950 dark:text-white">
                  {labels.editProduct}
                </h2>

                <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {labels.editProductDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelEditingProduct}
                className="w-fit rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                {labels.cancel}
              </button>
            </div>

            {messageContext === "edit" && message && (
              <div className="mt-5">
                <InlineFeedback message={message} type={messageType} />
              </div>
            )}

            <div className="mt-6">
              <ProductFormFields
                form={editForm}
                setForm={setEditProductForm}
                categories={categories}
                errors={productErrors}
                imageUrl={editImageUrl}
                setImageUrl={setEditImageUrl}
                onAddImageUrl={addEditImageUrl}
                onRemoveImage={removeEditImage}
                onUpload={(file) => void uploadImage(file, "edit")}
                isUploading={uploadingMode === "edit"}
                labels={labels}
              />
            </div>

            {selectedEditProduct && (
              <VariantManagementSection
                product={selectedEditProduct}
                labels={labels}
                variantDraft={
                  variantDrafts[selectedEditProduct.id] ?? getEmptyVariantForm()
                }
                variantEditDrafts={variantEditDrafts}
                updatingVariantKey={updatingVariantKey}
                errors={productErrors}
                message={message}
                messageType={messageType}
                messageContext={messageContext}
                onUpdateVariantDraft={updateVariantDraft}
                onUpdateVariantEditDraft={updateVariantEditDraft}
                onCreateVariant={(productId) => void createVariant(productId)}
                onUpdateVariant={(productId, variantId) =>
                  void updateVariant(productId, variantId)
                }
                onDeactivateVariant={(productId, variantId) =>
                  void deactivateVariant(productId, variantId)
                }
              />
            )}

            <button
              type="submit"
              disabled={isSavingProduct}
              className="workspace-primary-action mt-6 w-full rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProduct ? labels.saving : labels.saveProduct}
            </button>
          </form>
        )}
      </div>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-950 dark:text-white">
              {labels.productList}
            </h2>

            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {labels.productListDescription}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadAdminData()}
            className="w-fit rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-950"
          >
            {labels.refresh}
          </button>
        </div>

        <form
          onSubmit={handleApplyProductFilters}
          className="mt-6 grid gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
        >
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {labels.search}
              </label>
              <input
                value={productFilters.q}
                onChange={(event) =>
                  setProductFilters((current) => ({
                    ...current,
                    q: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
                placeholder={labels.searchPlaceholder}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {labels.categoryFilter}
              </label>
              <select
                value={productFilters.categoryId}
                onChange={(event) =>
                  setProductFilters((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
              >
                <option value="">{labels.allCategories}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {labels.statusFilter}
              </label>
              <select
                value={productFilters.status}
                onChange={(event) =>
                  setProductFilters((current) => ({
                    ...current,
                    status: event.target.value as ProductFilters["status"],
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
              >
                <option value="all">{labels.allStatuses}</option>
                <option value="active">{labels.activeStatus}</option>
                <option value="archived">{labels.archivedStatus}</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {labels.stockFilter}
              </label>
              <select
                value={productFilters.stock}
                onChange={(event) =>
                  setProductFilters((current) => ({
                    ...current,
                    stock: event.target.value as ProductFilters["stock"],
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
              >
                <option value="all">{labels.allStock}</option>
                <option value="in_stock">{labels.inStock}</option>
                <option value="out_of_stock">{labels.outOfStock}</option>
                <option value="low_stock">{labels.lowStock}</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {labels.sortBy}
              </label>
              <select
                value={productFilters.sort}
                onChange={(event) =>
                  setProductFilters((current) => ({
                    ...current,
                    sort: event.target.value as ProductFilters["sort"],
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none focus:border-orange-600 focus:ring-4 focus:ring-orange-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-orange-400 dark:focus:ring-orange-950"
              >
                <option value="newest">{labels.sortNewest}</option>
                <option value="oldest">{labels.sortOldest}</option>
                <option value="name_asc">{labels.sortNameAsc}</option>
                <option value="name_desc">{labels.sortNameDesc}</option>
                <option value="price_asc">{labels.sortPriceAsc}</option>
                <option value="price_desc">{labels.sortPriceDesc}</option>
                <option value="stock_asc">{labels.sortStockAsc}</option>
                <option value="stock_desc">{labels.sortStockDesc}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {labels.pageInfo
                .replace("{page}", String(productPagination.page))
                .replace(
                  "{totalPages}",
                  String(productPagination.totalPages),
                )}{" "}
              ·{" "}
              {labels.totalProducts.replace(
                "{count}",
                String(productPagination.total),
              )}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearProductFilters}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                {labels.clearFilters}
              </button>

              <button
                type="submit"
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {labels.applyFilters}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 space-y-4">
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {labels.noProductsYet}
            </div>
          ) : (
            products.map((product) => {
              const image = product.images.at(0);
              const isUpdating = updatingProductId === product.id;
              return (
                <article
                  key={product.id}
                  className="rounded-3xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-2xl bg-zinc-100 md:w-36 dark:bg-zinc-800">
                      {" "}
                      {image ? (
                        <OptimizedImage
                          src={image}
                          alt={product.name}
                          sizes="144px"
                          className="object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                          {labels.noImage}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                              {product.category.name}
                            </span>

                            {product.isFeatured && (
                              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                {labels.featured}
                              </span>
                            )}

                            {product.isArchived && (
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                                {labels.archived}
                              </span>
                            )}

                            {!product.showStock && (
                              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                                {labels.stockHidden}
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 truncate text-lg font-black text-zinc-950 dark:text-white">
                            {product.name}
                          </h3>

                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            /products/{product.slug}
                          </p>

                          <div className="mt-2">
                            <p className="text-lg font-black text-zinc-950 dark:text-white">
                              {formatPrice(getDisplayPrice(product))}
                            </p>

                            {hasProductDiscount(product) && (
                              <p className="text-xs font-semibold text-zinc-500 line-through dark:text-zinc-400">
                                {formatPrice(product.price)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                          <button
                            type="button"
                            onClick={() => startEditingProduct(product)}
                            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-950"
                          >
                            {labels.edit}
                          </button>

                          {product.isArchived ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => void restoreProduct(product.id)}
                              className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdating ? labels.restoring : labels.restore}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => void archiveProduct(product.id)}
                              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdating ? labels.archiving : labels.archive}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                          {labels.activeOptionStock}
                        </p>
                        <p className="mt-1 text-2xl font-black text-zinc-950 dark:text-white">
                          {getActiveVariantStockTotal(product)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          {labels.activeOptionStockHelp}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {labels.pageInfo
              .replace("{page}", String(productPagination.page))
              .replace("{totalPages}", String(productPagination.totalPages))}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={productPagination.page <= 1}
              onClick={() => goToProductPage(productPagination.page - 1)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-950"
            >
              {labels.previousPage}
            </button>

            <button
              type="button"
              disabled={productPagination.page >= productPagination.totalPages}
              onClick={() => goToProductPage(productPagination.page + 1)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-950"
            >
              {labels.nextPage}
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
