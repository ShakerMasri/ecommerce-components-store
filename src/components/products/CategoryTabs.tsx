type Category = {
  id: string;
  name: string;
  slug: string;
};

type CategoryTabsProps = {
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  allLabel: string;
  categoryLabel: string;
};

export function CategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
  allLabel,
  categoryLabel,
}: CategoryTabsProps) {
  const choices = [{ id: "all", name: allLabel, slug: null }, ...categories];

  return (
    <div className="max-w-full min-w-0">
      <label className="flex min-w-0 items-center gap-3 sm:hidden">
        <span className="shrink-0 text-sm font-semibold text-[var(--ink-muted)]">
          {categoryLabel}
        </span>
        <span className="relative min-w-0 flex-1">
          <select
            value={selectedCategory ?? ""}
            onChange={(event) => onCategoryChange(event.target.value || null)}
            className="min-h-11 w-full min-w-0 appearance-none rounded-xl border border-[var(--line-soft)] bg-[var(--surface-card)] py-2 ps-3 pe-10 text-sm font-semibold text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
          >
            {choices.map((category) => (
              <option key={category.id} value={category.slug ?? ""}>
                {category.name}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </label>

      <div
        role="group"
        aria-label={categoryLabel}
        className="flex min-w-0 flex-wrap gap-2 max-sm:hidden"
      >
        {choices.map((category) => {
          const isActive = selectedCategory === category.slug;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.slug)}
              aria-pressed={isActive}
              className={`min-h-11 max-w-full rounded-full border px-4 py-2 text-start text-sm font-semibold wrap-anywhere transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                isActive
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--surface-page)]"
                  : "border-[var(--line-soft)] bg-transparent text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
              }`}
            >
              <bdi>{category.name}</bdi>
            </button>
          );
        })}
      </div>
    </div>
  );
}
