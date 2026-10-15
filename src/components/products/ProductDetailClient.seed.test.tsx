import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AppPreferencesProvider,
  useAppPreferences,
} from "~/components/providers/AppPreferencesProvider";
import { type PublicProduct } from "~/lib/public-product";
import { ProductDetailClient } from "./ProductDetailClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("~/components/ui/OptimizedImage", () => ({
  OptimizedImage: ({ src, alt }: { src: string; alt: string }) => (
    <span data-testid="image" data-src={src}>
      {alt}
    </span>
  ),
  getOptimizedCloudinarySrc: (src: string) => src,
}));
const seed: PublicProduct = {
  id: "board",
  name: "Board",
  slug: "board",
  description: "Description",
  price: "25",
  discountPrice: null,
  images: ["/first.png", "/second.png"],
  stock: null,
  showStock: false,
  isInStock: true,
  isFeatured: false,
  hasVariants: true,
  category: { id: "category", name: "Components", slug: "components" },
  createdAt: "2026-10-13T00:00:00Z",
  variants: [
    {
      id: "stable-a",
      optionKey: "named:straight",
      optionLabel: "Straight",
      sizeLabel: null,
      colorLabel: null,
      stock: null,
      isInStock: true,
      sortOrder: 0,
    },
  ],
};
function LanguageControl() {
  const { toggleLanguage } = useAppPreferences();
  return <button onClick={toggleLanguage}>Language</button>;
}
function tree(product: PublicProduct) {
  return (
    <AppPreferencesProvider>
      <LanguageControl />
      <ProductDetailClient product={product} />
    </AppPreferencesProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("renders immediately without initial/language fetch and preserves choices on a current snapshot", async () => {
  const { rerender } = render(tree(seed));
  expect(screen.getByRole("heading", { name: "Board" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Straight/ }));
  const thumbnails = screen
    .getAllByRole("button")
    .filter((button) => button.querySelector('[data-testid="image"]'));
  await userEvent.click(thumbnails[1]!);
  await userEvent.click(screen.getByRole("button", { name: "Language" }));
  expect(document.documentElement.dir).toBe("rtl");
  expect(fetch).not.toHaveBeenCalled();
  rerender(tree({ ...seed, price: "30" }));
  expect(screen.getByText("₪30.00")).toBeVisible();
  expect(screen.getByRole("button", { name: /Straight/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getAllByTestId("image")[0]).toHaveAttribute(
    "data-src",
    "/second.png",
  );
});

it("drops removed/unavailable options and images on refresh and resets for a new slug", async () => {
  const { rerender } = render(tree(seed));
  await userEvent.click(screen.getByRole("button", { name: /Straight/ }));
  rerender(
    tree({
      ...seed,
      images: ["/replacement.png"],
      variants: [{ ...seed.variants[0]!, isInStock: false }],
      isInStock: false,
    }),
  );
  expect(screen.getByRole("button", { name: /Straight/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    screen.getByRole("button", { name: "Choose an option" }),
  ).toBeDisabled();
  expect(screen.getAllByTestId("image")[0]).toHaveAttribute(
    "data-src",
    "/replacement.png",
  );
  rerender(
    tree({
      ...seed,
      id: "next-board",
      slug: "next-board",
      name: "Next board",
      variants: [
        {
          ...seed.variants[0]!,
          id: "stable-default-next",
          optionKey: "default",
          optionLabel: null,
        },
      ],
      hasVariants: false,
    }),
  );
  expect(screen.getByRole("heading", { name: "Next board" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  expect(screen.getAllByTestId("image")[0]).toHaveAttribute(
    "data-src",
    "/first.png",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  "10 pcs Jumper wires",
  "٣ قطع أسلاك",
  "ESP32-S3 وحدة تطوير",
  "لوحة ESP32-S3",
])(
  "keeps the accessible product name isolated across language changes: %s",
  async (name) => {
    const { rerender } = render(tree({ ...seed, name }));
    const heading = screen.getByRole("heading", { level: 1, name });
    const isolatedName = heading.querySelector("bdi");
    expect(isolatedName).toHaveAttribute("dir", "auto");
    expect(isolatedName).toHaveTextContent(name);
    expect(document.documentElement.dir).toBe("ltr");

    await userEvent.click(screen.getByRole("button", { name: "Language" }));
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("heading", { level: 1, name })).toBe(heading);
    expect(heading.querySelector("bdi")).toBe(isolatedName);
    expect(isolatedName).toHaveAttribute("dir", "auto");

    rerender(
      tree({
        ...seed,
        id: "next-title",
        slug: "next-title",
        name: "7 × لوحة ESP32",
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "7 × لوحة ESP32" }),
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  },
);
