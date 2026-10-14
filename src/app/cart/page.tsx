import { CartClient } from "~/components/cart/CartClient";
import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function CartPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <CartClient />
    </main>
  );
}
