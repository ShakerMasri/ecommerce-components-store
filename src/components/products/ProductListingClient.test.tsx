import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const categories = Array.from({ length: 80 }, (_, index) => ({
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
  it.each([0, 5, 80])(
    "bounds the closed toolbar regardless of category count (%i categories)",
    async (count) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(response(1, count))),
      );
      render(<ProductListingClient />);
      await screen.findByRole("link", { name: "Test board 1" });

      const trigger = screen.getByRole("button", { name: "All categories" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger.hasAttribute("disabled")).toBe(count === 0);
      expect(
        screen.queryByRole("searchbox", { name: "Search categories" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "All products" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        within(screen.getByRole("group", { name: "Category" })).getAllByRole(
          "button",
        ),
      ).toHaveLength(Math.min(count, 3) + 2);
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

      const picker = screen.getByRole("button", {
        name: t.products.allCategories,
      });
      await user.click(picker);
      const search = screen.getByRole("searchbox", {
        name: t.products.searchCategories,
      });
      expect(search).toHaveFocus();
      const callsBeforeSearch = fetchMock.mock.calls.length;
      await user.type(search, " 5 ");
      expect(fetchMock.mock.calls).toHaveLength(callsBeforeSearch);
      await user.click(screen.getByRole("button", { name: "Components 5" }));
      await waitFor(() =>
        expect(latestQuery().get("category")).toBe("components-5"),
      );
      expect(picker).toHaveAccessibleName(
        `${t.products.allCategories}: Components 5`,
      );
      expect(picker).toHaveAttribute("aria-expanded", "false");
      expect(picker).toHaveFocus();

      await user.type(
        screen.getByRole("searchbox", { name: t.products.searchLabel }),
        " ESP32 ",
      );
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
      expect(picker).toHaveAccessibleName(
        `${t.products.allCategories}: Components 2`,
      );
      expect(latestQuery().get("page")).toBe("1");
      expect(latestQuery().get("search")).toBe("ESP32");
      await user.click(
        screen.getByRole("button", { name: t.products.allProducts }),
      );
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
    await user.click(screen.getByRole("button", { name: "All categories" }));
    await user.click(screen.getByRole("button", { name: "Components 5" }));
    await screen.findByText(translations.en.products.noProductsTitle);
    expect(screen.getByText("Showing 0 products")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: translations.en.actions.clearFilters,
      }),
    );
    await screen.findByRole("link", { name: "Test board 1" });
    expect(
      screen.getByRole("button", { name: "All categories" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(latestQuery().has("category")).toBe(false);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Catalog unavailable" }), {
        status: 503,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Components 1" }));
    await screen.findByText("Catalog unavailable");
    expect(screen.queryByText("Showing 1 product")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Components 2" }));
    await screen.findByRole("link", { name: "Test board 1" });
    expect(screen.queryByText("Catalog unavailable")).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)(
    "searches a large list locally and handles no matches and keyboard dismissal (%s)",
    async (language) => {
      preferences.language = language;
      const t = translations[language];
      fetchMock.mockImplementation(
        async () => new Response(JSON.stringify(response(1, 80))),
      );
      const user = userEvent.setup();
      render(<ProductListingClient />);
      await screen.findByRole("link", { name: "Test board 1" });
      const trigger = screen.getByRole("button", {
        name: t.products.allCategories,
      });
      await user.click(trigger);
      const panel = document.getElementById(
        trigger.getAttribute("aria-controls")!,
      );
      expect(panel).not.toBeNull();
      const search = screen.getByRole("searchbox", {
        name: t.products.searchCategories,
      });
      const callsBeforeSearch = fetchMock.mock.calls.length;
      await user.type(search, "No match");
      expect(screen.getByRole("status")).toHaveTextContent(
        t.products.noCategoriesFound,
      );
      await user.clear(search);
      await user.type(search, "cOMPONENTS 79");
      expect(fetchMock.mock.calls).toHaveLength(callsBeforeSearch);
      await user.tab();
      await user.tab();
      expect(
        screen.getByRole("button", { name: "Components 79" }),
      ).toHaveFocus();
      await user.keyboard("{Enter}");
      await waitFor(() =>
        expect(latestQuery().get("category")).toBe("components-79"),
      );
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAccessibleName(
        `${t.products.allCategories}: Components 79`,
      );
      await user.click(trigger);
      expect(
        screen.getByRole("searchbox", { name: t.products.searchCategories }),
      ).toHaveValue("");
      expect(
        within(panel!).getByRole("button", { name: "Components 79" }),
      ).toHaveAttribute("aria-pressed", "true");
      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
      await user.click(trigger);
      await user.click(
        screen.getByRole("searchbox", { name: t.products.searchLabel }),
      );
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.getByRole("searchbox", { name: t.products.searchLabel }),
      ).toHaveFocus();
    },
  );

  it("closes when Tab leaves the dropdown without stealing focus", async () => {
    const user = userEvent.setup();
    render(<ProductListingClient />);
    await screen.findByRole("link", { name: "Test board 1" });
    const trigger = screen.getByRole("button", { name: "All categories" });
    await user.click(trigger);
    screen.getByRole("button", { name: "Components 5" }).focus();
    await user.tab();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Test board 1" })).toHaveFocus();
  });
});
