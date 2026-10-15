"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";

export function ProductRecovery({ reset }: { reset?: () => void }) {
  const { t } = useAppPreferences();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <div
        role={reset ? "alert" : undefined}
        className="rounded-3xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-8 text-center"
      >
        <h1 className="text-2xl font-black text-[var(--ink)]">
          {reset ? t.products.failedToLoadProduct : t.products.productNotFound}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {reset ? t.products.failedToConnect : t.products.productUnavailable}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {reset ? (
            <button
              type="button"
              onClick={() => {
                // Reset with the fresh RSC payload, rather than replaying the failed one.
                startTransition(() => {
                  router.refresh();
                  reset();
                });
              }}
              disabled={isPending}
              aria-busy={isPending}
              className="min-h-11 rounded-full bg-[var(--ink)] px-5 py-2.5 font-semibold text-[var(--surface-page)]"
            >
              {t.cart.tryAgain}
            </button>
          ) : null}
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--line-soft)] px-5 py-2.5 font-semibold text-[var(--ink)]"
          >
            {t.actions.backToProducts}
          </Link>
        </div>
      </div>
    </section>
  );
}
