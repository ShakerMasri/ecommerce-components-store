"use client";

import { ProductRecovery } from "~/components/products/ProductRecovery";

export default function ProductError({ reset }: { reset: () => void }) {
  return <ProductRecovery reset={reset} />;
}
