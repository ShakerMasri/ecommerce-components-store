import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";
import { translations } from "~/lib/translations";
import { ProductDetailClient } from "./ProductDetailClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
const product = {
  id: "p",
  name: "Illustrative component",
  slug: "test",
  description: "Test",
  price: "10",
  discountPrice: null,
  images: [],
  stock: 4,
  isInStock: true,
  showStock: true,
  isFeatured: false,
  hasVariants: true,
  category: { name: "Electronics", slug: "test" },
};
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe.each(["en", "ar"] as const)(
  "neutral product selection in %s",
  (language) => {
    const t = translations[language];
    function mount(variants: unknown[]) {
      localStorage.setItem("language", language);
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      const fetchMock = vi
        .fn()
        .mockImplementation(async (_url: string, init?: RequestInit) => ({
          ok: true,
          json: async () =>
            init?.method === "POST"
              ? {}
              : { product: { ...product, variants } },
        }));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <AppPreferencesProvider>
          <ProductDetailClient slug="test" />
        </AppPreferencesProvider>,
      );
      return fetchMock;
    }
    it("purchases a default with no selector and its stable variant ID", async () => {
      const fetchMock = mount([
        {
          id: "default-id",
          optionKey: "default",
          optionLabel: null,
          stock: 4,
          isInStock: true,
        },
      ]);
      const add = await screen.findByRole("button", { name: t.cart.addToCart });
      expect(add).toBeEnabled();
      expect(
        screen.queryByText(t.products.selectOptionHelp),
      ).not.toBeInTheDocument();
      expect(document.documentElement.dir).toBe(
        language === "ar" ? "rtl" : "ltr",
      );
      await userEvent.click(add);
      const call = fetchMock.mock.calls.find(
        (call) => call[1]?.method === "POST",
      )!;
      expect(JSON.parse(call[1].body)).toEqual({
        productId: "p",
        productVariantId: "default-id",
        quantity: 1,
      });
    });
    it("requires deliberate keyboard selection and blocks an out-of-stock choice", async () => {
      const fetchMock = mount([
        {
          id: "a",
          optionKey: "named:موصل",
          optionLabel: "موصل",
          stock: 4,
          isInStock: true,
        },
        {
          id: "b",
          optionKey: "named:angled",
          optionLabel: "Angled",
          stock: 0,
          isInStock: false,
        },
      ]);
      expect(
        await screen.findByRole("button", { name: t.cart.chooseOption }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: /Angled/ })).toBeDisabled();
      const choice = screen.getByRole("button", { name: /موصل/ });
      choice.focus();
      await userEvent.keyboard("{Enter}");
      expect(choice).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(
        screen.getByRole("button", { name: t.cart.addToCart }),
      );
      expect(
        JSON.parse(
          fetchMock.mock.calls.find((call) => call[1]?.method === "POST")![1]
            .body,
        ).productVariantId,
      ).toBe("a");
    });
    it("announces localized add-to-cart failures", async () => {
      const fetchMock = mount([
        {
          id: "a",
          optionKey: "default",
          optionLabel: null,
          stock: 4,
          isInStock: true,
        },
      ]);
      const add = await screen.findByRole("button", { name: t.cart.addToCart });
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({}),
      });
      await userEvent.click(add);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        t.cart.failedToAddItem,
      );
    });
  },
);
