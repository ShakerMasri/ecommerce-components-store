"use client";

import { useId, useState } from "react";
import { useAppPreferences } from "~/components/providers/AppPreferencesProvider";

type KitItem = { name: string; quantity: number };

function parseDescription(description: string | null) {
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

function KitContents({ items }: { items: KitItem[] }) {
  const { t, language } = useAppPreferences();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const visibleItems = expanded ? items : items.slice(0, 5);
  const formatQuantity = new Intl.NumberFormat(language);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-3xl border border-[var(--line-soft)] p-4"
    >
      <h2 id={`${id}-title`} className="text-sm font-bold text-[var(--ink)]">
        {t.products.kitContentsTitle}
      </h2>
      <ul id={`${id}-list`} className="mt-2 divide-y divide-[var(--line-soft)]">
        {visibleItems.map((item, index) => (
          <li
            key={index}
            className="flex items-start justify-between gap-3 py-3"
          >
            <bdi className="min-w-0 text-sm leading-6 [overflow-wrap:anywhere] text-[var(--ink-muted)]">
              {item.name}
            </bdi>
            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              <span className="sr-only">{t.products.kitQuantity}: </span>
              <bdi dir="ltr">
                <span aria-hidden="true">×</span>
                {formatQuantity.format(item.quantity)}
              </bdi>
            </span>
          </li>
        ))}
      </ul>
      {items.length > 5 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 min-h-11 rounded-lg px-2 text-start text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
        >
          {expanded
            ? t.products.showFewerComponents
            : `${t.products.showAllComponents} (${formatQuantity.format(items.length)})`}
        </button>
      ) : null}
    </section>
  );
}

export function ProductDescription({
  description,
}: {
  description: string | null;
}) {
  const { t } = useAppPreferences();
  const parsed = parseDescription(description);

  return (
    <>
      {parsed.description.trim() || parsed.items.length === 0 ? (
        <div className="rounded-3xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--accent-soft)]">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {t.products.descriptionTitle}
          </h2>
          <p className="mt-2 text-sm leading-7 break-words whitespace-pre-line text-[var(--ink-muted)]">
            {parsed.description.trim()
              ? parsed.description
              : t.products.noDescription}
          </p>
        </div>
      ) : null}
      {parsed.items.length > 0 ? (
        <KitContents key={description} items={parsed.items} />
      ) : null}
    </>
  );
}
