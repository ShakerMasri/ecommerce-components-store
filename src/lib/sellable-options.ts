export const DEFAULT_OPTION_KEY = "default";

export function normalizeOptionKey(label: string) {
  return `named:${label.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ")}`;
}

export function isMappedOption(option: {
  optionKey?: string | null;
  optionLabel?: string | null;
}) {
  return option.optionKey === DEFAULT_OPTION_KEY
    ? !option.optionLabel
    : Boolean(
        option.optionLabel &&
        option.optionKey === normalizeOptionKey(option.optionLabel),
      );
}

export function historicalOptionLabel(item: {
  selectedOptionLabel?: string | null;
  selectedSizeLabel: string | null;
  selectedColorLabel: string | null;
}) {
  return (
    item.selectedOptionLabel ??
    ([item.selectedSizeLabel, item.selectedColorLabel]
      .filter(Boolean)
      .join(" / ") ||
      null)
  );
}

type LegacyOption = {
  id: string;
  productId: string;
  optionKey: string | null;
  optionLabel: string | null;
  sizeLabel: string | null;
  colorLabel: string | null;
};

export function planOptionBackfill(rows: LegacyOption[]) {
  const candidates = rows.map((row) => {
    const label = [row.sizeLabel, row.colorLabel]
      .filter(Boolean)
      .join(" / ")
      .trim();
    return {
      row,
      label,
      key: row.optionKey ?? (label ? normalizeOptionKey(label) : null),
    };
  });
  const changes: { id: string; optionLabel: string; optionKey: string }[] = [];
  const unresolved: { id: string; reason: string }[] = [];
  for (const { row, label, key } of candidates) {
    if (row.optionKey) {
      if (!isMappedOption(row))
        unresolved.push({ id: row.id, reason: "invalid-existing-mapping" });
      continue;
    }
    if (!key || !label || label.length > 160 || key.length > 200) {
      unresolved.push({ id: row.id, reason: "blank-or-overlong-label" });
    } else if (
      candidates.some(
        (other) =>
          other.row.id !== row.id &&
          other.row.productId === row.productId &&
          other.key === key,
      )
    ) {
      unresolved.push({ id: row.id, reason: "normalized-key-collision" });
    } else {
      changes.push({ id: row.id, optionLabel: label, optionKey: key });
    }
  }
  return { changes, unresolved };
}
