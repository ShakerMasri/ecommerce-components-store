import { describe, expect, it } from "vitest";
import { type PublicProduct } from "~/lib/public-product";
import {
  productMarkup,
  serializeProductMarkup,
  usableProductImages,
} from "./product-markup";

const product: PublicProduct = {
  id: "public-id",
  name: "Synthetic board",
  slug: "synthetic-board",
  price: "25.50",
  discountPrice: null,
  images: ["https://example.invalid/board.png"],
  stock: null,
  isInStock: true,
  showStock: false,
  isFeatured: false,
  hasVariants: false,
  category: { id: "category", name: "Components", slug: "components" },
  createdAt: "2026-10-14T00:00:00Z",
  description: null,
  variants: [
    {
      id: "default-id",
      optionKey: "default",
      optionLabel: null,
      sizeLabel: null,
      colorLabel: null,
      stock: null,
      isInStock: true,
      sortOrder: 0,
    },
  ],
};

describe("truthful default-option Product/Offer markup", () => {
  it.each([
    {
      discountPrice: null,
      inStock: true,
      price: 25.5,
      availability: "InStock",
    },
    {
      discountPrice: "20.25",
      inStock: false,
      price: 20.25,
      availability: "OutOfStock",
    },
  ])(
    "uses server effective price and option availability: $availability",
    ({ discountPrice, inStock, price, availability }) => {
      const markup = productMarkup({
        ...product,
        discountPrice,
        variants: [{ ...product.variants[0]!, isInStock: inStock }],
      });
      expect(markup).toMatchObject({
        "@type": "Product",
        name: product.name,
        image: product.images,
        url: "https://darakit.com/products/synthetic-board",
        offers: {
          "@type": "Offer",
          price,
          priceCurrency: "ILS",
          availability: `https://schema.org/${availability}`,
        },
      });
      expect(markup).not.toHaveProperty("description");
      expect(Object.keys(markup!.offers).sort()).toEqual([
        "@type",
        "availability",
        "price",
        "priceCurrency",
        "url",
      ]);
    },
  );

  it.each(["0", "-1", "NaN", "Infinity", "", " "])(
    "omits nonpositive/nonfinite effective price %s",
    (price) => {
      expect(productMarkup({ ...product, price })).toBeNull();
      expect(productMarkup({ ...product, discountPrice: price })).toBeNull();
    },
  );
  it.each([
    { name: "  " },
    { images: [] },
    { images: ["/favicon.svg", "javascript:alert(1)"] },
    { variants: [] },
    { variants: [{ ...product.variants[0]!, optionKey: null }] },
    {
      variants: [
        {
          ...product.variants[0]!,
          optionKey: "named:angled",
          optionLabel: "Angled",
        },
      ],
    },
    { variants: [{ ...product.variants[0]!, optionLabel: "invalid default" }] },
    {
      variants: [
        product.variants[0]!,
        { ...product.variants[0]!, id: "another" },
      ],
    },
  ])("omits incomplete, unmapped or nondefault products %j", (changes) => {
    expect(productMarkup({ ...product, ...changes })).toBeNull();
  });
  it("filters unusable images without substituting artwork", () => {
    expect(
      usableProductImages([
        "data:image/png;base64,test",
        "https://user:secret@example.invalid/a.png",
        "javascript:alert(1)",
        "bad",
        "/logo.png",
        "http://example.invalid/a.png",
        ...product.images,
      ]),
    ).toEqual(["http://example.invalid/a.png", ...product.images]);
  });
  it.each([
    'Literal </ScRiPt><script>window.attack=1</script> <!-- "دارة" -->\n[kit-contents]\n2 | موصل <script>\n[/kit-contents]',
    "Literal </script> <!-- -->\n[kit-contents]\n0 | malformed\n[/kit-contents]",
  ])(
    "escapes the whole JSON object independently of React escaping",
    (description) => {
      const name = 'Board "دارة" </ScRiPt><script>window.attack=2</script><!--';
      const markup = productMarkup({
        ...product,
        name,
        description,
        images: ['https://example.invalid/</sCrIpT><!--"دارة".png'],
      })!;
      const serialized = serializeProductMarkup(markup);
      expect(serialized).not.toContain("<");
      expect(serialized).toContain("\\u003c");
      expect(JSON.parse(serialized)).toEqual(markup);
      expect(markup.name).toBe(name);
      expect(markup.description?.includes("[kit-contents]")).toBe(
        description.includes("0 |"),
      );
      const host = document.createElement("div");
      host.innerHTML = `<script type="application/ld+json">${serialized}</script>`;
      expect(host.children).toHaveLength(1);
      expect(host.querySelectorAll("script")).toHaveLength(1);
      expect(JSON.parse(host.firstChild!.textContent!)).toEqual(markup);
      expect(serialized).not.toMatch(
        /stock|default-id|category|createdAt|sortOrder/,
      );
    },
  );
});
