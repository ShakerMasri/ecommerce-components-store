import { storeConfig } from "~/config/store";
import { productDescriptionSnippet } from "~/lib/product-description";
import { type PublicProduct } from "~/lib/public-product";
import { DEFAULT_OPTION_KEY, isMappedOption } from "~/lib/sellable-options";

export function usableProductImages(images: string[]) {
  return images.filter((image) => {
    try {
      const url = new URL(image);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });
}

export function productMarkup(product: PublicProduct) {
  const option = product.variants[0];
  const images = usableProductImages(product.images);
  const price = Number(product.discountPrice ?? product.price);
  if (
    product.variants.length !== 1 ||
    option?.optionKey !== DEFAULT_OPTION_KEY ||
    !isMappedOption(option) ||
    !product.name.trim() ||
    !images.length ||
    !Number.isFinite(price) ||
    price <= 0
  )
    return null;

  const url = `${storeConfig.url}/products/${product.slug}`;
  const description = productDescriptionSnippet(product.description);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(description ? { description } : {}),
    url,
    image: images,
    offers: {
      "@type": "Offer",
      url,
      price,
      priceCurrency: "ILS",
      availability: `https://schema.org/${option.isInStock ? "InStock" : "OutOfStock"}`,
    },
  };
}

export function serializeProductMarkup(
  markup: NonNullable<ReturnType<typeof productMarkup>>,
) {
  return JSON.stringify(markup).replace(/</g, "\\u003c");
}
