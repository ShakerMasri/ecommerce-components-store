import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { translations, type Language } from "~/lib/translations";
import { ProductListingClient } from "./ProductListingClient";

const preferences = vi.hoisted((): { language: Language } => ({
  language: "en",
}));

vi.mock("~/components/providers/AppPreferencesProvider", () => ({
  useAppPreferences: () => ({ t: translations[preferences.language] }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    "aria-label"?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const categories = Array.from({ length: 6 }, (_, index) => ({
  id: `category-${index}`,
  name: `Components ${index}`,
  slug: `components-${index}`,
}));

function response(page = 1, categoryCount = 6, products = true) {
  return {
    categories: categories.slice(0, categoryCount),
    products: products
      ? [
          {
            id: `board-${page}`,
            name: `Test board ${page}`,
            slug: `test-board-${page}`,
            price: "25",
            discountPrice: null,
            stock: 2,
            isInStock: true,
            showStock: true,
            images: [],
            category: categories[0],
          },
        ]
      : [],
    pagination: { page, pageSize: 12, hasMore: page === 1, nextPage: 2 },
  };
}

const fetchMock = vi.fn<typeof fetch>();

function requestUrl(input: RequestInfo | URL) {
  return new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    "http://localhost",
  );
}

beforeEach(() => {
  preferences.language = "en";
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = requestUrl(input);
    return new Response(
      JSON.stringify(response(Number(url.searchParams.get("page")))),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function latestQuery() {
  const input = fetchMock.mock.calls.at(-1)?.[0];
  if (!input) throw new Error("Expected a catalog request");
  return requestUrl(input).searchParams;
}

describe("customer catalog category controls", () => {
  it.each([0, 5])(
    "keeps all choices available in either control (%i categories)",
    async (count) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(response(1, count))),
      );
      render(<ProductListingClient />);
      await screen.findByRole("link", { name: "Test board 1" });

      expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue(
        "",
      );
      expect(screen.getAllByRole("option")).toHaveLength(count + 1);
      expect(
        screen.getByRole("button", { name: "All products" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen
          .getByRole("group", { name: "Category" })
          .querySelectorAll("button"),
      ).toHaveLength(count + 1);
    },
  );

  it.each(["en", "ar"] as const)(
    "uses the labelled picker with the existing search, paging and filter state (%s)",
    async (language) => {
      preferences.language = language;
      const t = translations[language];
      const user = userEvent.setup();
      render(<ProductListingClient />);
      await screen.findByRole("link", { name: "Test board 1" });

      const picker = screen.getByRole("combobox", {
        name: t.products.categoryLabel,
      });
      expect(picker).toHaveValue("");
      expect(screen.getAllByRole("option")).toHaveLength(7);
      await user.selectOptions(picker, "components-5");
      await waitFor(() =>
        expect(latestQuery().get("category")).toBe("components-5"),
      );
      expect(picker).toHaveValue("components-5");
      expect(
        screen.getByRole("button", { name: "Components 5" }),
      ).toHaveAttribute("aria-pressed", "true");

      await user.type(screen.getByRole("searchbox"), " ESP32 ");
      await user.click(
        screen.getByRole("button", { name: t.products.searchButton }),
      );
      await waitFor(() => expect(latestQuery().get("search")).toBe("ESP32"));
      expect(latestQuery().get("category")).toBe("components-5");
      await user.click(
        screen.getByRole("button", { name: t.products.loadMore }),
      );
      await screen.findByRole("link", { name: "Test board 2" });
      expect(
        screen.getByRole("link", { name: "Test board 1" }),
      ).toBeInTheDocument();
      expect(latestQuery().get("page")).toBe("2");
      expect(latestQuery().get("category")).toBe("components-5");
      expect(latestQuery().get("search")).toBe("ESP32");

      await user.click(screen.getByRole("button", { name: "Components 2" }));
      await waitFor(() =>
        expect(latestQuery().get("category")).toBe("components-2"),
      );
      expect(picker).toHaveValue("components-2");
      expect(latestQuery().get("page")).toBe("1");
      expect(latestQuery().get("search")).toBe("ESP32");
      await user.selectOptions(picker, "");
      await waitFor(() => expect(latestQuery().has("category")).toBe(false));
      expect(latestQuery().get("search")).toBe("ESP32");
    },
  );

  it("retains empty-result clearing and error recovery", async () => {
    const user = userEvent.setup();
    render(<ProductListingClient />);
    await screen.findByRole("link", { name: "Test board 1" });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(response(1, 6, false))),
    );
    await user.selectOptions(screen.getByRole("combobox"), "components-5");
    await screen.findByText(translations.en.products.noProductsTitle);
    expect(screen.getByText("Showing 0 products")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: translations.en.actions.clearFilters,
      }),
    );
    await screen.findByRole("link", { name: "Test board 1" });
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(latestQuery().has("category")).toBe(false);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Catalog unavailable" }), {
        status: 503,
      }),
    );
    await user.selectOptions(screen.getByRole("combobox"), "components-1");
    await screen.findByText("Catalog unavailable");
    expect(screen.queryByText("Showing 1 product")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "components-2");
    await screen.findByRole("link", { name: "Test board 1" });
    expect(screen.queryByText("Catalog unavailable")).not.toBeInTheDocument();
  });
});
