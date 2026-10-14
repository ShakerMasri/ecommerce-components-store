import { Suspense } from "react";
import { ResetPasswordForm } from "~/components/auth/ResetPasswordForm";
import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="premium-shell h-44 animate-pulse rounded-[2rem] bg-[var(--surface-muted)]" />
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
