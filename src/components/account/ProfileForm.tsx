"use client";

import Link from "next/link";
import { PHONE_INPUT_MAX_LENGTH, phoneSchema } from "~/lib/phone";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";

type ProfileFormProps = {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
    phone: string;
  };
};

type SaveStatus = "idle" | "saving" | "success" | "error";

type ProfileFieldErrors = {
  name?: string;
  phone?: string;
};

type ProfileResponse = {
  message?: string;
  errors?: {
    name?: string[];
    phone?: string[];
  };
};

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const { t } = useAppPreferences();

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});

  const isSaving = status === "saving";

  function validateForm() {
    const nextFieldErrors: ProfileFieldErrors = {};
    const trimmedName = name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      nextFieldErrors.name = t.profile.nameInvalid;
    }

    if (!phoneSchema.safeParse(phone).success) {
      nextFieldErrors.phone = t.profile.phoneInvalid;
    }

    return nextFieldErrors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("saving");
    setMessage("");
    setFieldErrors({});

    const nextFieldErrors = validateForm();

    if (Object.keys(nextFieldErrors).length > 0) {
      setStatus("error");
      setFieldErrors(nextFieldErrors);
      setMessage(t.profile.fixHighlightedFields);
      return;
    }

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ProfileResponse;

      if (!response.ok) {
        const nextFieldErrors: ProfileFieldErrors = {
          name: data.errors?.name?.length ? t.profile.nameInvalid : undefined,
          phone: data.errors?.phone?.length
            ? t.profile.phoneInvalid
            : undefined,
        };
        const hasFieldErrors = Boolean(
          nextFieldErrors.name ?? nextFieldErrors.phone,
        );

        setStatus("error");
        setFieldErrors(nextFieldErrors);
        setMessage(
          hasFieldErrors
            ? t.profile.fixHighlightedFields
            : t.profile.failedToUpdate,
        );
        return;
      }

      setStatus("success");
      setMessage(t.profile.updatedSuccessfully);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage(t.profile.failedToConnect);
    }
  }

  return (
    <main className="workspace-ui mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold tracking-wide text-orange-600 uppercase dark:text-orange-400">
          {t.profile.badge}
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
          {t.profile.title}
        </h1>

        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {t.profile.description}
        </p>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="font-semibold text-zinc-950 dark:text-white">
            {user.email}
          </p>

          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {t.profile.emailStatus}:{" "}
            <span className="font-semibold">
              {user.emailVerified ? t.profile.verified : t.profile.notVerified}
            </span>
          </p>

          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-500">
            {t.profile.emailChangeHelp}
          </p>
        </div>

        {message && status === "success" && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <label
              htmlFor="name"
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              {t.profile.name}
            </label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
              required
              className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none placeholder:text-zinc-400 focus:ring-4 dark:bg-zinc-950 dark:text-white ${
                fieldErrors.name
                  ? "border-red-300 focus:border-red-600 focus:ring-red-100 dark:border-red-900 dark:focus:border-red-400 dark:focus:ring-red-950"
                  : "border-zinc-300 focus:border-orange-600 focus:ring-orange-100 dark:border-zinc-700 dark:focus:border-orange-400 dark:focus:ring-orange-950"
              }`}
              aria-invalid={fieldErrors.name ? "true" : undefined}
              aria-describedby={
                fieldErrors.name ? "profile-name-error" : undefined
              }
            />

            {fieldErrors.name && (
              <p
                id="profile-name-error"
                className="mt-2 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              {t.profile.phoneNumber}
            </label>

            <input
              id="phone"
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
              className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-950 transition outline-none placeholder:text-zinc-400 focus:ring-4 dark:bg-zinc-950 dark:text-white ${
                fieldErrors.phone
                  ? "border-red-300 focus:border-red-600 focus:ring-red-100 dark:border-red-900 dark:focus:border-red-400 dark:focus:ring-red-950"
                  : "border-zinc-300 focus:border-orange-600 focus:ring-orange-100 dark:border-zinc-700 dark:focus:border-orange-400 dark:focus:ring-orange-950"
              }`}
              placeholder="+970599000000"
              aria-invalid={fieldErrors.phone ? "true" : undefined}
              aria-describedby={
                fieldErrors.phone ? "profile-phone-error" : "profile-phone-help"
              }
            />

            {fieldErrors.phone ? (
              <p
                id="profile-phone-error"
                className="mt-2 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {fieldErrors.phone}
              </p>
            ) : (
              <p
                id="profile-phone-help"
                className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
              >
                {t.profile.phoneHelp}
              </p>
            )}
          </div>

          <div className="space-y-3 pt-1">
            {message && status === "error" && (
              <p
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {message}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSaving}
                className="workspace-primary-action rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? t.profile.saving : t.profile.saveProfile}
              </button>

              <Link
                href="/account"
                className="rounded-full border border-zinc-300 px-5 py-3 text-center text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {t.profile.backToAccount}
              </Link>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
