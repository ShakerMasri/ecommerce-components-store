import { Suspense } from "react";
import { LoginForm } from "~/components/auth/LoginForm";
import { env } from "~/env";
import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function LoginPage() {
  const googleSignInEnabled = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="premium-shell h-96 animate-pulse rounded-[2rem] bg-[var(--surface-muted)]" />
        </main>
      }
    >
      <LoginForm googleSignInEnabled={googleSignInEnabled} />
    </Suspense>
  );
}
