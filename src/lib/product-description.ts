export type KitItem = { name: string; quantity: number };

export function parseProductDescription(description: string | null) {
  const original = description ?? "";
  const fallback = { description: original, items: [] as KitItem[] };
  const lines = original.split(/\r?\n/);
  const starts = lines.flatMap((line, index) =>
    line.trim() === "[kit-contents]" ? [index] : [],
  );
  const ends = lines.flatMap((line, index) =>
    line.trim() === "[/kit-contents]" ? [index] : [],
  );
  const start = starts[0];
  const end = ends[0];

  // Only consume one complete, valid block. Keep malformed content visible.
  if (
    starts.length !== 1 ||
    ends.length !== 1 ||
    start === undefined ||
    end === undefined ||
    end <= start
  ) {
    return fallback;
  }

  const items: KitItem[] = [];
  for (const line of lines.slice(start + 1, end)) {
    if (!line.trim()) continue;

    const separator = line.indexOf("|");
    if (separator === -1) return fallback;

    const quantityText = line
      .slice(0, separator)
      .trim()
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0));
    const quantity = Number(quantityText);
    const name = line.slice(separator + 1).trim();

    if (
      !/^[1-9]\d*$/.test(quantityText) ||
      !Number.isSafeInteger(quantity) ||
      !name
    ) {
      return fallback;
    }

    items.push({ name, quantity });
  }
  if (items.length === 0) return fallback;

  return {
    description: [
      lines.slice(0, start).join("\n").trim(),
      lines
        .slice(end + 1)
        .join("\n")
        .trim(),
    ]
      .filter(Boolean)
      .join("\n\n"),
    items,
  };
}

// Derive snippets from the same interpretation as the visible description.
export function productDescriptionSnippet(description: string | null) {
  const parsed = parseProductDescription(description);
  const text = [
    parsed.description,
    ...parsed.items.map((item) => `${item.name} × ${item.quantity}`),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? Array.from(text).slice(0, 160).join("") : null;
}
