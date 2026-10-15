import { type Metadata } from "next";

// Let crawlers see noindex on these pages; robots.txt is not access control.
export const nonIndexableMetadata: Metadata = {
  robots: { index: false, follow: true },
};
