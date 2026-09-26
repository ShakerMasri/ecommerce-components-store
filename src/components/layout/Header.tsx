"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";
import { storeConfig } from "~/config/store";

const navLinks = [
  { href: "/", key: "home" },
  { href: "/products", key: "products" },
  { href: "/cart", key: "cart" },
  { href: "/orders", key: "orders" },
  { href: "/account", key: "account" },
] as const;

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { theme, language, t, toggleTheme, toggleLanguage } =
    useAppPreferences();

  const brand =
    language === "ar" ? storeConfig.locales.ar : storeConfig.locales.en;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line-soft)] bg-[var(--surface-page)]/92 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-6 lg:px-8 lg:py-4">
        <Link
          href="/"
          className="min-w-0 rounded-md text-[var(--ink)]"
          aria-label={brand.name}
        >
          <span className="block text-base leading-snug font-bold sm:text-lg">
            {brand.name}
          </span>
        </Link>

        <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-2 lg:col-start-3">
          <button
            type="button"
            onClick={toggleLanguage}
            className="min-h-11 rounded-lg border border-[var(--line-soft)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]"
            aria-label={t.actions.toggleLanguage}
          >
            {language === "en"
              ? t.actions.switchToArabic
              : t.actions.switchToEnglish}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--line-soft)] bg-[var(--surface-card)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]"
            aria-label={
              theme === "dark" ? t.actions.lightMode : t.actions.darkMode
            }
            title={theme === "dark" ? t.actions.lightMode : t.actions.darkMode}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        <nav
          aria-label={brand.name}
          className="col-span-2 row-start-2 grid grid-cols-5 gap-1 border-t border-[var(--line-soft)] pt-3 text-[13px] font-semibold sm:text-sm lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex lg:border-0 lg:pt-0"
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href ||
                  pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 py-2 text-center transition sm:px-3 ${
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {t.nav[link.key]}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
