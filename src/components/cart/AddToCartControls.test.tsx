import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";
import { translations } from "~/lib/translations";
import { AddToCartControls } from "./AddToCartControls";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it.each(["en", "ar"] as const)(
  "caps visible and hidden stock at 99 in %s and allows reduction",
  async (language) => {
    localStorage.setItem("language", language);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const view = (stock: number | null) => (
      <AppPreferencesProvider>
        <AddToCartControls
          productId="product"
          productVariantId="variant"
          stock={stock}
          isInStock
        />
      </AppPreferencesProvider>
    );
    const { rerender } = render(view(1000));
    const t = translations[language];
    const increase = screen.getByRole("button", {
      name: t.cart.increaseQuantity,
    });
    for (let i = 1; i < 99; i++) fireEvent.click(increase);
    expect(increase).toBeDisabled();
    fireEvent.click(increase);
    fireEvent.click(screen.getByRole("button", { name: t.cart.addToCart }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      productId: "product",
      productVariantId: "variant",
      quantity: 99,
    });
    await screen.findByRole("status");
    fireEvent.click(
      screen.getByRole("button", { name: t.cart.decreaseQuantity }),
    );
    expect(increase).toBeEnabled();
    rerender(view(3));
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(increase).toBeDisabled();
    rerender(view(null));
    for (let i = 3; i < 99; i++) fireEvent.click(increase);
    expect(increase).toBeDisabled();
    expect(screen.getByText("99")).toBeInTheDocument();
  },
);
