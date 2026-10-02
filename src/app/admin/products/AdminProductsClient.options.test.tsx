import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";
import { translations } from "~/lib/translations";
import { AdminProductsClient } from "./AdminProductsClient";
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);

afterEach(() => {
  if (originalScrollIntoView)
    Object.defineProperty(
      Element.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe.each(["en", "ar"] as const)(
  "simple product admin creation in %s",
  (language) => {
    it("explicitly submits an atomic transition and announces stale-state errors", async () => {
      const labels = translations[language].admin.products;
      localStorage.setItem("language", language);
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      Element.prototype.scrollIntoView = vi.fn();
      const optionId = "clh1q2w3e000108l4a5b6c7d9";
      const product = {
        id: "clh1q2w3e000008l4a5b6c7d8",
        name: "Illustrative component",
        slug: "test",
        description: null,
        price: "10",
        discountPrice: null,
        stock: 0,
        images: [],
        isArchived: false,
        isFeatured: false,
        showStock: true,
        category: { id: "c", name: "Test", slug: "test" },
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        variants: [
          {
            id: optionId,
            optionKey: "default",
            optionLabel: null,
            stock: 4,
            isActive: true,
            sortOrder: 0,
          },
        ],
      };
      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, init?: RequestInit) => ({
          ok: init?.method !== "POST",
          json: async () =>
            init?.method === "POST"
              ? {
                  errors: {
                    _form: ["A transition option changed. Reload the product."],
                  },
                }
              : url.includes("categories")
                ? { categories: [{ id: "c", name: "Test", slug: "test" }] }
                : { products: [product] },
        }));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <AppPreferencesProvider>
          <AdminProductsClient />
        </AppPreferencesProvider>,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: labels.edit }),
      );
      const labelInput = screen
        .getAllByRole("textbox", { name: labels.optionLabel })
        .find((input) => !(input as HTMLInputElement).disabled)!;
      await userEvent.type(labelInput, "موصل");
      const add = screen.getByRole("button", { name: labels.addOption });
      const grid = add.parentElement!;
      await userEvent.clear(within(grid).getByRole("spinbutton"));
      await userEvent.type(within(grid).getByRole("spinbutton"), "3");
      await userEvent.click(
        screen
          .getAllByRole("checkbox", { name: labels.deactivateOtherOptions })
          .at(-1)!,
      );
      await userEvent.click(add);
      const call = fetchMock.mock.calls.find(
        (call) => call[1]?.method === "POST",
      )!;
      expect(JSON.parse(call[1].body)).toMatchObject({
        optionLabel: "موصل",
        stock: "3",
        isDefault: false,
        deactivateOptionIds: [optionId],
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        labels.invalidOptionState,
      );
    });
    it("submits initial stock and presents localized accessible stock errors", async () => {
      const labels = translations[language].admin.products;
      localStorage.setItem("language", language);
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, init?: RequestInit) => {
          if (init?.method === "POST")
            return {
              ok: false,
              json: async () => ({ errors: { stock: ["Invalid stock"] } }),
            };
          return {
            ok: true,
            json: async () =>
              url.includes("categories")
                ? {
                    categories: [
                      {
                        id: "c",
                        name: "Test category",
                        slug: "test",
                        productCount: 0,
                      },
                    ],
                  }
                : { products: [] },
          };
        });
      vi.stubGlobal("fetch", fetchMock);
      render(
        <AppPreferencesProvider>
          <AdminProductsClient />
        </AppPreferencesProvider>,
      );
      await userEvent.click(
        await screen.findByRole("button", { name: labels.addProduct }),
      );
      const stock = screen.getByRole("spinbutton", { name: labels.stock });
      await userEvent.clear(stock);
      await userEvent.type(stock, "4");
      const form = stock.closest("form")!;
      await userEvent.type(
        within(form).getByPlaceholderText(labels.productNamePlaceholder),
        "Illustrative component",
      );
      await userEvent.type(
        within(form).getByPlaceholderText(labels.slugPlaceholder),
        "illustrative-component",
      );
      await userEvent.type(within(form).getByPlaceholderText("19.99"), "10");
      await userEvent.selectOptions(within(form).getByRole("combobox"), "c");
      await userEvent.click(
        within(form).getByRole("button", { name: labels.createProductButton }),
      );
      const call = fetchMock.mock.calls.find(
        (call) => call[1]?.method === "POST",
      )!;
      expect(JSON.parse(call[1].body)).toMatchObject({
        stock: "4",
        price: "10",
        name: "Illustrative component",
      });
      expect(JSON.parse(call[1].body)).not.toHaveProperty("sizeLabel");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        labels.invalidOptionStock,
      );
      expect(stock).toHaveAttribute("aria-invalid", "true");
      expect(document.documentElement.dir).toBe(
        language === "ar" ? "rtl" : "ltr",
      );
    });
  },
);
