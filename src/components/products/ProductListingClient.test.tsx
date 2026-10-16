import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
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

function pendingResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe.each(["en", "ar"] as const)(
  "catalog replacement recovery in %s",
  (language) => {
    const cases = (["category", "search", "manual"] as const).flatMap(
      (filter) =>
        (["http", "network"] as const).flatMap((failure) =>
          (["success", "failure"] as const).map((obsolete) => ({
            filter,
            failure,
            obsolete,
          })),
        ),
    );
    it.each(cases)(
      "retries page 1 after $filter $failure failure despite obsolete $obsolete",
      async ({ filter, failure, obsolete }) => {
        preferences.language = language;
        const t = translations[language];
        fetchMock.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              ...response(),
              pagination: { page: 6, pageSize: 12, hasMore: true, nextPage: 7 },
            }),
          ),
        );
        render(<ProductListingClient />);
        await screen.findByRole("link", { name: "Test board 1" });
        const oldAppend = pendingResponse();
        fetchMock.mockReturnValueOnce(oldAppend.promise);
        fireEvent.click(
          screen.getByRole("button", { name: t.products.loadMore }),
        );
        expect(latestQuery().get("page")).toBe("7");
        const oldSignal = fetchMock.mock.calls.at(-1)![1]!.signal!;
        const fail = () => {
          if (failure === "http")
            fetchMock.mockResolvedValueOnce(
              new Response(JSON.stringify({ message: "Replacement outage" }), {
                status: 503,
              }),
            );
          else
            fetchMock.mockRejectedValueOnce(
              new Error("Synthetic connection failure"),
            );
        };
        fail();
        const search = screen.getByRole("searchbox", {
          name: t.products.searchLabel,
        });
        if (filter === "category")
          fireEvent.click(screen.getByRole("button", { name: "Components 1" }));
        else {
          if (filter === "search")
            fireEvent.change(search, { target: { value: "sensor" } });
          fireEvent.submit(search.closest("form")!);
        }
        const error =
          failure === "http"
            ? "Replacement outage"
            : t.products.failedToConnect;
        await screen.findByText(error);
        expect(screen.getByRole("alert")).toHaveTextContent(error);
        expect(oldSignal.aborted).toBe(true);
        const filters = {
          category: latestQuery().get("category"),
          search: latestQuery().get("search"),
        };
        expect(filters).toEqual({
          category: filter === "category" ? "components-1" : null,
          search: filter === "search" ? "sensor" : null,
        });
        expect(latestQuery().get("page")).toBe("1");
        expect(
          screen.queryByRole("button", { name: t.products.loadMore }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("link", { name: "Test board 1" }),
        ).not.toBeInTheDocument();

        // Repeated failures must keep retrying page 1 with the applied filters.
        fail();
        fireEvent.click(screen.getByRole("button", { name: t.cart.tryAgain }));
        await screen.findByText(error);
        expect(latestQuery().get("page")).toBe("1");
        expect(
          screen.queryByRole("button", { name: t.products.loadMore }),
        ).not.toBeInTheDocument();
        const retry = pendingResponse();
        fetchMock.mockReturnValueOnce(retry.promise);
        fireEvent.click(screen.getByRole("button", { name: t.cart.tryAgain }));
        expect(
          screen.getByRole("button", { name: t.products.searchButton }),
        ).toBeDisabled();
        await act(async () => {
          if (obsolete === "failure")
            oldAppend.reject(new Error("Obsolete connection error"));
          else
            oldAppend.resolve(
              new Response(
                JSON.stringify({
                  ...response(99),
                  pagination: {
                    page: 98,
                    pageSize: 12,
                    hasMore: true,
                    nextPage: 99,
                  },
                }),
              ),
            );
          await oldAppend.promise.catch(() => undefined);
        });
        expect(
          screen.getByRole("button", { name: t.products.searchButton }),
        ).toBeDisabled();
        expect(
          screen.queryByRole("button", { name: t.products.loadMore }),
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        await act(async () => {
          retry.resolve(new Response(JSON.stringify(response())));
        });
        await screen.findByRole("link", { name: "Test board 1" });
        expect(
          screen.queryByRole("link", { name: "Test board 99" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: t.cart.tryAgain }),
        ).not.toBeInTheDocument();
        fireEvent.click(
          screen.getByRole("button", { name: t.products.loadMore }),
        );
        expect(latestQuery().get("page")).toBe("2");
        expect({
          category: latestQuery().get("category"),
          search: latestQuery().get("search"),
        }).toEqual(filters);
        await screen.findByRole("link", { name: "Test board 2" });
        expect(
          screen.getByRole("link", { name: "Test board 1" }),
        ).toBeInTheDocument();
      },
    );

    it.each(["http", "network"])(
      "keeps products and the same-page append retry after %s failure",
      async (failure) => {
        preferences.language = language;
        const t = translations[language];
        render(<ProductListingClient />);
        await screen.findByRole("link", { name: "Test board 1" });
        if (failure === "http")
          fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "Append outage" }), {
              status: 503,
            }),
          );
        else fetchMock.mockRejectedValueOnce(new Error("Append failed"));
        fireEvent.click(
          screen.getByRole("button", { name: t.products.loadMore }),
        );
        await screen.findByText(
          failure === "http" ? "Append outage" : t.products.failedToConnect,
        );
        expect(
          screen.getByRole("link", { name: "Test board 1" }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: t.cart.tryAgain }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: t.products.loadMore }),
        ).toBeEnabled();
        fireEvent.click(
          screen.getByRole("button", { name: t.products.loadMore }),
        );
        expect(latestQuery().get("page")).toBe("2");
        await screen.findByRole("link", { name: "Test board 2" });
        expect(
          screen.getByRole("link", { name: "Test board 1" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      },
    );
  },
);

describe.each(["en", "ar"] as const)(
  "catalog request ownership in %s",
  (language) => {
    const cases = (["append", "manual"] as const).flatMap((mode) =>
      (["category", "search"] as const).flatMap((filter) =>
        (["success", "http failure", "network failure"] as const).flatMap(
          (outcome) =>
            (["before replacement", "after replacement"] as const).map(
              (timing) => ({ mode, filter, outcome, timing }),
            ),
        ),
      ),
    );
    it.each(cases)(
      "ignores $mode $outcome $timing after $filter changes",
      async ({ mode, filter, outcome, timing }) => {
        preferences.language = language;
        const t = translations[language];
        const old = pendingResponse();
        const replacement = pendingResponse();
        const nextAppend = pendingResponse();
        fetchMock.mockResolvedValueOnce(
          new Response(JSON.stringify(response())),
        );
        render(<ProductListingClient />);
        await screen.findByRole("link", { name: "Test board 1" });
        fetchMock
          .mockReturnValueOnce(old.promise)
          .mockReturnValueOnce(replacement.promise)
          .mockReturnValueOnce(nextAppend.promise);
        const search = screen.getByRole("searchbox", {
          name: t.products.searchLabel,
        });
        const form = search.closest("form")!;
        if (mode === "append")
          fireEvent.click(
            screen.getByRole("button", { name: t.products.loadMore }),
          );
        else fireEvent.submit(form);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const oldSignal = fetchMock.mock.calls[1]![1]!.signal!;
        if (filter === "category")
          fireEvent.click(screen.getByRole("button", { name: "Components 1" }));
        else {
          fireEvent.change(search, { target: { value: "sensor" } });
          fireEvent.submit(form);
        }
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        expect(oldSignal.aborted).toBe(true);
        expect(
          latestQuery().get(filter === "category" ? "category" : "search"),
        ).toBe(filter === "category" ? "components-1" : "sensor");
        const settleOld = async () => {
          await act(async () => {
            if (outcome === "network failure")
              old.reject(new Error("obsolete failure"));
            else
              old.resolve(
                new Response(
                  JSON.stringify(
                    outcome === "http failure"
                      ? { message: "obsolete server error" }
                      : { ...response(99), categories: [] },
                  ),
                  { status: outcome === "http failure" ? 503 : 200 },
                ),
              );
            await old.promise.catch(() => undefined);
          });
        };
        const searchButton = screen.getByRole("button", {
          name: t.products.searchButton,
        });
        if (timing === "before replacement") {
          await settleOld();
          expect(searchButton).toBeDisabled();
          expect(
            screen.queryByRole("link", { name: "Test board 99" }),
          ).not.toBeInTheDocument();
          expect(
            screen.queryByText("obsolete server error"),
          ).not.toBeInTheDocument();
          expect(
            screen.queryByText(t.products.failedToConnect),
          ).not.toBeInTheDocument();
        }
        await act(async () => {
          replacement.resolve(
            new Response(
              JSON.stringify({
                ...response(3),
                pagination: {
                  page: 1,
                  pageSize: 12,
                  hasMore: true,
                  nextPage: 7,
                },
              }),
            ),
          );
        });
        await screen.findByRole("link", { name: "Test board 3" });
        expect(searchButton).toBeEnabled();
        fireEvent.click(
          screen.getByRole("button", { name: t.products.loadMore }),
        );
        expect(latestQuery().get("page")).toBe("7");
        if (timing === "after replacement") await settleOld();
        expect(
          screen.getByRole("button", { name: t.products.loadingMore }),
        ).toBeDisabled();
        expect(
          screen.getByRole("link", { name: "Test board 3" }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("link", { name: "Test board 99" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText("obsolete server error"),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText(t.products.failedToConnect),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Components 2" }),
        ).toBeInTheDocument();
        await act(async () => {
          nextAppend.resolve(new Response(JSON.stringify(response(7))));
        });
        await screen.findByRole("link", { name: "Test board 7" });
        expect(
          screen.getByRole("link", { name: "Test board 3" }),
        ).toBeInTheDocument();
        expect(searchButton).toBeEnabled();
        expect(
          screen.queryByRole("button", { name: t.products.loadMore }),
        ).not.toBeInTheDocument();
      },
    );

    it.each(["success", "failure"])(
      "preserves the current error after an obsolete effect %s and permits recovery",
      async (outcome) => {
        preferences.language = language;
        const t = translations[language];
        fetchMock.mockResolvedValueOnce(
          new Response(JSON.stringify(response())),
        );
        render(<ProductListingClient />);
        await screen.findByRole("link", { name: "Test board 1" });
        const old = pendingResponse();
        fetchMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce(
          new Response(JSON.stringify({ message: "Current outage" }), {
            status: 503,
          }),
        );
        fireEvent.click(screen.getByRole("button", { name: "Components 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Components 2" }));
        await screen.findByText("Current outage");
        await act(async () => {
          if (outcome === "failure") old.reject(new Error("obsolete failure"));
          else old.resolve(new Response(JSON.stringify(response(99))));
          await old.promise.catch(() => undefined);
        });
        expect(screen.getByText("Current outage")).toBeInTheDocument();
        expect(
          screen.queryByRole("link", { name: "Test board 99" }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: t.products.searchButton }),
        ).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Components 0" }));
        await screen.findByRole("link", { name: "Test board 1" });
        expect(screen.queryByText("Current outage")).not.toBeInTheDocument();
      },
    );

    it("aborts manual requests on unmount and ignores a late JSON body", async () => {
      preferences.language = language;
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(response())));
      const { unmount } = render(<ProductListingClient />);
      await screen.findByRole("link", { name: "Test board 1" });
      const oldBody = pendingResponse();
      let signal: AbortSignal | null | undefined;
      fetchMock.mockImplementationOnce(async (_input, init) => {
        signal = init?.signal;
        return {
          ok: true,
          json: async () => (await oldBody.promise).json(),
        } as Response;
      });
      fireEvent.submit(
        screen
          .getByRole("searchbox", {
            name: translations[language].products.searchLabel,
          })
          .closest("form")!,
      );
      await waitFor(() => expect(signal).toBeDefined());
      unmount();
      expect(signal!.aborted).toBe(true);
      await act(async () => {
        oldBody.resolve(new Response(JSON.stringify(response())));
      });
    });
  },
);

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
