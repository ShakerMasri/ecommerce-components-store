import { type MetadataRoute } from "next";
import { storeConfig } from "~/config/store";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // The client-rendered catalog needs its public API when crawlers render it.
      allow: ["/", "/api/products"],
      disallow: "/api/",
    },
    sitemap: `${storeConfig.url}/sitemap.xml`,
  };
}
