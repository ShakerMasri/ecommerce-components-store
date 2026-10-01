"use client";

import Link from "next/link";
import { PHONE_INPUT_MAX_LENGTH, phoneSchema } from "~/lib/phone";
import { useRef, useState } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { authClient } from "~/lib/auth-client";

type RegisterStatus = "idle" | "loading" | "google" | "success" | "error";

type RegisterFormProps = {
  googleSignInEnabled: boolean;
};

type RegisterFieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
};

const inputClassName =
  "mt-2 w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--ink)] transition outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]";

const invalidInputClassName =
  "border-[var(--danger-ink)]/50 focus:border-[var(--danger-ink)] focus:ring-[color-mix(in_srgb,var(--danger-ink)_18%,transparent)]";

const labelClassName = "text-sm font-semibold text-[var(--ink)]";

const fieldErrorClassName =
  "mt-2 rounded-xl border border-[var(--danger-ink)]/25 bg-[var(--danger-soft)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--danger-ink)]";

const mutedTextClassName = "text-sm leading-6 text-[var(--ink-muted)]";

const accentLinkClassName =
  "font-semibold text-[var(--accent-strong)] transition hover:text-[var(--accent)]";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildInputClassName(hasError: boolean) {
  return hasError
    ? `${inputClassName} ${invalidInputClassName}`
    : inputClassName;
}

function getFriendlyRegisterError(
  rawMessage: string | undefined,
  t: ReturnType<typeof useAppPreferences>["t"],
): { message: string; fieldErrors: RegisterFieldErrors } {
  const normalized = rawMessage?.toLowerCase() ?? "";
  const fieldErrors: RegisterFieldErrors = {};

  if (normalized.includes("email")) {
    fieldErrors.email = t.auth.emailInvalid;
  }

  if (normalized.includes("phone")) {
    fieldErrors.phone = t.auth.phoneInvalid;
  }

  if (normalized.includes("password")) {
    fieldErrors.password = t.auth.passwordTooShort;
  }

  if (normalized.includes("name")) {
    fieldErrors.name = t.auth.nameInvalid;
  }

  const hasFieldError = Object.keys(fieldErrors).length > 0;

  return {
    message: hasFieldError
      ? t.auth.fixHighlightedFields
      : t.auth.failedToRegister,
    fieldErrors,
  };
}

export function RegisterForm({ googleSignInEnabled }: RegisterFormProps) {
  const { t } = useAppPreferences();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  function focusFirstInvalidField(nextFieldErrors: RegisterFieldErrors) {
    const firstInvalidInput =
      (nextFieldErrors.name && nameInputRef.current) ??
      (nextFieldErrors.email && emailInputRef.current) ??
      (nextFieldErrors.phone && phoneInputRef.current) ??
      (nextFieldErrors.password && passwordInputRef.current) ??
      null;

    if (!firstInvalidInput) {
      return;
    }

    window.requestAnimationFrame(() => {
      firstInvalidInput.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      firstInvalidInput.focus({ preventScroll: true });
    });
  }

  function validateForm() {
    const nextFieldErrors: RegisterFieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      nextFieldErrors.name = t.auth.nameInvalid;
    }

    if (!emailPattern.test(trimmedEmail)) {
      nextFieldErrors.email = t.auth.emailInvalid;
    }

    if (!phoneSchema.safeParse(phone).success) {
      nextFieldErrors.phone = t.auth.phoneInvalid;
    }

    if (password.length < 8) {
      nextFieldErrors.password = t.auth.passwordTooShort;
    }

    return nextFieldErrors;
  }

  async function handleGoogleSignIn() {
    setStatus("google");
    setMessage("");
    setFieldErrors({});

    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/products",
      errorCallbackURL: "/register",
      newUserCallbackURL: "/products",
    });

    if (error) {
      setStatus("error");
      setMessage(t.auth.googleSignInFailed);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage("");
    setFieldErrors({});

    const nextFieldErrors = validateForm();

    if (Object.keys(nextFieldErrors).length > 0) {
      setStatus("error");
      setFieldErrors(nextFieldErrors);
      setMessage(t.auth.fixHighlightedFields);
      focusFirstInvalidField(nextFieldErrors);
      return;
    }

    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      callbackURL: "/login?verified=success",
    });

    if (error) {
      const friendlyError = getFriendlyRegisterError(error.message, t);

      setStatus("error");
      setFieldErrors(friendlyError.fieldErrors);
      setMessage(friendlyError.message);
      focusFirstInvalidField(friendlyError.fieldErrors);
      return;
    }

    setStatus("success");
    setMessage(t.auth.registerVerifyEmailSuccess);
  }

  const isSubmitting = status === "loading";
  const isStartingGoogleSignIn = status === "google";
  const hasMessage = Boolean(message);
  const hasError = status === "error" && hasMessage;
  const hasSuccess = status === "success" && hasMessage;

  return (
    <main className="mx-auto grid min-h-[calc(100vh-180px)] max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:px-8">
      <section className="hidden lg:block">
        <p className="inline-flex rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 py-1 text-sm font-semibold text-[var(--accent-strong)]">
          {t.auth.registerBadge}
        </p>

        <h1 className="mt-6 max-w-xl text-5xl font-black tracking-tight text-[var(--ink)]">
          {t.auth.registerHeroTitle}
        </h1>

        <p className="mt-5 max-w-xl text-base leading-7 text-[var(--ink-muted)]">
          {t.auth.registerHeroDescription}
        </p>
      </section>

      <section className="premium-shell rounded-[2rem] p-5 sm:p-8">
        <div>
          <p className="inline-flex rounded-full border border-[var(--line-soft)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold tracking-[0.18em] text-[var(--accent-strong)] uppercase lg:hidden">
            {t.auth.registerBadge}
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--ink)] lg:mt-0">
            {t.auth.registerTitle}
          </h1>

          <p className={`mt-2 ${mutedTextClassName}`}>
            {t.auth.registerDescription}
          </p>
        </div>

        {hasSuccess && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-[var(--success-ink)]/30 bg-[var(--success-soft)] p-4 text-sm font-medium text-[var(--success-ink)]"
          >
            {message}
          </div>
        )}

        {googleSignInEnabled && (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={
                isSubmitting || isStartingGoogleSignIn || status === "success"
              }
              className="flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--line-soft)] bg-[var(--surface-elevated)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStartingGoogleSignIn
                ? t.auth.continuingWithGoogle
                : t.auth.continueWithGoogle}
            </button>

            <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-[var(--ink-muted)] uppercase">
              <span className="h-px flex-1 bg-[var(--line-soft)]" />
              <span>{t.auth.orContinueWithEmail}</span>
              <span className="h-px flex-1 bg-[var(--line-soft)]" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <label htmlFor="name" className={labelClassName}>
              {t.auth.name}
            </label>

            <input
              id="name"
              ref={nameInputRef}
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
              required
              className={buildInputClassName(Boolean(fieldErrors.name))}
              placeholder={t.auth.name}
              aria-invalid={fieldErrors.name ? "true" : undefined}
              aria-describedby={
                fieldErrors.name ? "register-name-error" : undefined
              }
            />

            {fieldErrors.name && (
              <p id="register-name-error" className={fieldErrorClassName}>
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className={labelClassName}>
              {t.auth.email}
            </label>

            <input
              id="email"
              ref={emailInputRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              required
              className={buildInputClassName(Boolean(fieldErrors.email))}
              placeholder="you@example.com"
              aria-invalid={fieldErrors.email ? "true" : undefined}
              aria-describedby={
                fieldErrors.email ? "register-email-error" : undefined
              }
            />

            {fieldErrors.email && (
              <p id="register-email-error" className={fieldErrorClassName}>
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className={labelClassName}>
              {t.auth.phone}
            </label>

            <input
              id="phone"
              ref={phoneInputRef}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setFieldErrors((current) => ({ ...current, phone: undefined }));
              }}
              required
              minLength={8}
              maxLength={PHONE_INPUT_MAX_LENGTH}
              pattern="^\\+?[0-9\\s\\-()]{8,20}$"
              className={buildInputClassName(Boolean(fieldErrors.phone))}
              placeholder="+970599000000"
              aria-invalid={fieldErrors.phone ? "true" : undefined}
              aria-describedby={
                fieldErrors.phone
                  ? "register-phone-error"
                  : "register-phone-help"
              }
            />

            {fieldErrors.phone ? (
              <p id="register-phone-error" className={fieldErrorClassName}>
                {fieldErrors.phone}
              </p>
            ) : (
              <p
                id="register-phone-help"
                className="mt-2 text-xs leading-5 text-[var(--ink-muted)]"
              >
                {t.auth.phoneHelp}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className={labelClassName}>
              {t.auth.password}
            </label>

            <input
              id="password"
              ref={passwordInputRef}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  password: undefined,
                }));
              }}
              required
              minLength={8}
              className={buildInputClassName(Boolean(fieldErrors.password))}
              placeholder={t.auth.passwordPlaceholder}
              aria-invalid={fieldErrors.password ? "true" : undefined}
              aria-describedby={
                fieldErrors.password
                  ? "register-password-error"
                  : "register-password-help"
              }
            />

            {fieldErrors.password ? (
              <p id="register-password-error" className={fieldErrorClassName}>
                {fieldErrors.password}
              </p>
            ) : (
              <p
                id="register-password-help"
                className="mt-2 text-xs leading-5 text-[var(--ink-muted)]"
              >
                {t.auth.passwordHelp}
              </p>
            )}
          </div>

          <div className="space-y-3 pt-1">
            {hasError && (
              <p
                role="alert"
                className="rounded-2xl border border-[var(--danger-ink)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger-ink)]"
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting || isStartingGoogleSignIn || status === "success"
              }
              className="min-h-12 w-full rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--surface-page)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t.auth.creatingAccount : t.auth.createAccount}
            </button>
          </div>

          <p className="text-center text-xs leading-5 text-[var(--ink-muted)]">
            {t.legal.notices.byCreatingAccount}{" "}
            <Link href="/privacy" className={accentLinkClassName}>
              {t.legal.notices.privacyPolicy}
            </Link>{" "}
            {t.legal.notices.and}{" "}
            <Link href="/terms" className={accentLinkClassName}>
              {t.legal.notices.termsOfUse}
            </Link>
            .
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
          {t.auth.alreadyHaveAccount}{" "}
          <Link href="/login" className={accentLinkClassName}>
            {t.auth.login}
          </Link>
        </p>
      </section>
    </main>
  );
}
