// Client-safe public catalog contract. Exact inventory is nullable by policy.
export type PublicProductSummary = {
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
  category: { id: string; name: string; slug: string };
};

export type PublicProductVariant = {
  id: string;
  optionKey: string | null;
  optionLabel: string | null;
  sizeLabel: string | null;
  colorLabel: string | null;
  stock: number | null;
  isInStock: boolean;
  sortOrder: number;
};

export type PublicProduct = PublicProductSummary & {
  description: string | null;
  createdAt: string;
  variants: PublicProductVariant[];
};
