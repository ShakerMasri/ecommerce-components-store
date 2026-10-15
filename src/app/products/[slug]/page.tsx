import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "~/components/products/ProductDetailClient";
import { storeConfig } from "~/config/store";
import { productDescriptionSnippet } from "~/lib/product-description";
import {
  productMarkup,
  serializeProductMarkup,
  usableProductImages,
} from "~/lib/product-markup";
import { getPublicProduct } from "~/server/public-products";
import { productSlugSchema } from "~/server/validations/product";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function requireProduct(params: ProductPageProps["params"]) {
  const { slug } = await params;
  const parsed = productSlugSchema.safeParse({ slug });
  if (!parsed.success) notFound();
  const product = await getPublicProduct(parsed.data.slug);
  if (!product) notFound();
  return product;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const product = await requireProduct(params);
  const title = `${product.name} | ${storeConfig.name}`;
  const description = productDescriptionSnippet(product.description);
  const url = `${storeConfig.url}/products/${product.slug}`;
  const images = usableProductImages(product.images).map((url) => ({
    url,
    alt: product.name,
  }));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: storeConfig.name,
      title,
      url,
      ...(description ? { description } : {}),
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      ...(description ? { description } : {}),
      images,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  // Resolve 404/5xx before returning JSX. Do not add an early loading shell.
  const product = await requireProduct(params);
  const markup = productMarkup(product);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {markup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeProductMarkup(markup) }}
        />
      )}
      <ProductDetailClient product={product} />
    </div>
  );
}
