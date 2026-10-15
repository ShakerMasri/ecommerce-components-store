import { type Metadata } from "next";
import { storeConfig } from "~/config/store";
import { ProductListingClient } from "~/components/products/ProductListingClient";

export const metadata: Metadata = {
  title: `Products | ${storeConfig.name}`,
  description: storeConfig.description,
  alternates: { canonical: `${storeConfig.url}/products` },
  openGraph: {
    title: `Products | ${storeConfig.name}`,
    description: storeConfig.description,
    url: `${storeConfig.url}/products`,
    type: "website",
    siteName: storeConfig.name,
  },
  twitter: {
    card: "summary",
    title: `Products | ${storeConfig.name}`,
    description: storeConfig.description,
  },
};

export default function ProductsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ProductListingClient />
    </main>
  );
}
