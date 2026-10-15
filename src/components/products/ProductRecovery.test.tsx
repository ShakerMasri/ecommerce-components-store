import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ProductError from "~/app/products/[slug]/error";
import ProductNotFound from "~/app/products/[slug]/not-found";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";
import { translations } from "~/lib/translations";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it.each(["en", "ar"] as const)(
  "%s service recovery requests fresh server data on each actual retry click",
  async (language) => {
    localStorage.setItem("language", language);
    const t = translations[language];
    const reset = vi.fn();
    render(
      <AppPreferencesProvider>
        <ProductError reset={reset} />
      </AppPreferencesProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      t.products.failedToLoadProduct,
    );
    expect(document.documentElement.dir).toBe(
      language === "ar" ? "rtl" : "ltr",
    );
    expect(
      screen.getByRole("link", { name: t.actions.backToProducts }),
    ).toHaveAttribute("href", "/products");

    const user = userEvent.setup();
    const retry = screen.getByRole("button", { name: t.cart.tryAgain });
    await user.click(retry);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);

    // A continuing outage leaves the same control available for another attempt.
    expect(retry).toBeEnabled();
    retry.focus();
    await user.keyboard("{Enter}");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each(["en", "ar"] as const)(
  "%s missing-product recovery keeps catalog navigation without a service retry",
  (language) => {
    localStorage.setItem("language", language);
    const t = translations[language];
    render(
      <AppPreferencesProvider>
        <ProductNotFound />
      </AppPreferencesProvider>,
    );
    expect(
      screen.getByRole("heading", { name: t.products.productNotFound }),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t.cart.tryAgain }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: t.actions.backToProducts }),
    ).toHaveAttribute("href", "/products");
    expect(refresh).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  },
);
