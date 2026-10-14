import { OrdersClient } from "~/components/orders/OrdersClient";
import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function OrdersPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <OrdersClient />
    </main>
  );
}
