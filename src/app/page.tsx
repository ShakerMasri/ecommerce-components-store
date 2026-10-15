import { type Metadata } from "next";
import { HomeClient } from "~/components/HomeClient";
import { storeConfig } from "~/config/store";

export const metadata: Metadata = {
  title: storeConfig.metadata.title,
  description: storeConfig.metadata.description,
  alternates: { canonical: storeConfig.url },
  openGraph: {
    ...storeConfig.metadata,
    url: storeConfig.url,
    type: "website",
    siteName: storeConfig.name,
  },
};

export default function HomePage() {
  return <HomeClient />;
}
