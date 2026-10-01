import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";
import { translations } from "~/lib/translations";
import { PHONE_INPUT_MAX_LENGTH, phoneSchema } from "~/lib/phone";
import { CartClient } from "./CartClient";

const cart = {
  customer: {
    name: "Test",
    email: "test@example.com",
    emailVerified: true,
    phone: "",
  },
  cartItems: [
    {
      id: "item",
      quantity: 1,
      productVariantId: null,
      productVariant: null,
      availableStock: 2,
      isAvailable: true,
      hasEnoughStock: true,
      product: {
        id: "product",
        name: "Test electronics",
        slug: "test",
        price: "10",
        discountPrice: null,
        stock: 2,
        isInStock: true,
        images: [],
        isArchived: false,
        showStock: true,
        hasVariants: false,
        category: { name: "Electronics", slug: "electronics" },
      },
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe.each(["en", "ar"] as const)("checkout phone in %s", (language) => {
  it("keeps entry/display LTR and blocks invalid phones with localized feedback", async () => {
    localStorage.setItem("language", language);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => cart });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    render(
      <AppPreferencesProvider>
        <CartClient />
      </AppPreferencesProvider>,
    );
    const t = translations[language];
    const phone = await screen.findByRole("textbox", { name: t.auth.phone });
    expect(document.documentElement.dir).toBe(
      language === "ar" ? "rtl" : "ltr",
    );
    expect(phone).toHaveAttribute("dir", "ltr");
    fireEvent.change(
      screen.getByRole("textbox", { name: t.cart.deliveryCity }),
      { target: { value: "Ramallah" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: t.cart.deliveryAddress }),
      { target: { value: "Test street 12" } },
    );
    for (const value of [
      "----------",
      "\\----------",
      "1---------",
      "+---------",
      "+971502345678",
    ]) {
      fireEvent.change(phone, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: t.cart.reviewOrder }));
      expect(phone).toHaveAttribute("aria-invalid", "true");
      expect(phone).toHaveAccessibleDescription(t.auth.phoneInvalid);
      expect(fetchMock.mock.calls.every(([url]) => url === "/api/cart")).toBe(
        true,
      );
    }
    const user = userEvent.setup();
    await user.clear(phone);
    await user.type(phone, "00970 (59) 912 - 3456");
    expect(phone).toHaveValue("00970 (59) 912 - 3456");
    expect(phone).toHaveAttribute("maxLength", String(PHONE_INPUT_MAX_LENGTH));
    expect(phoneSchema.parse((phone as HTMLInputElement).value)).toBe(
      "+970599123456",
    );
    fireEvent.click(screen.getByRole("button", { name: t.cart.reviewOrder }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("00970 (59) 912 - 3456")).toHaveAttribute(
      "dir",
      "ltr",
    );
    expect(phone).toHaveAttribute("aria-invalid", "false");
  });
});
