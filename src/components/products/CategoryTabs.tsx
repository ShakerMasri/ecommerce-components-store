import { useId, useLayoutEffect, useRef, useState } from "react";

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
  allCategoriesLabel: string;
  searchCategoriesLabel: string;
  noCategoriesLabel: string;
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]";

function shortcutClass(active: boolean) {
  return `min-h-11 max-w-44 rounded-full border px-4 py-2 text-sm font-semibold transition ${focusRing} ${active ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--surface-page)]" : "border-[var(--line-soft)] bg-transparent text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"}`;
}

export function CategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
  allLabel,
  categoryLabel,
  allCategoriesLabel,
  searchCategoriesLabel,
  noCategoriesLabel,
}: CategoryTabsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelLayout, setPanelLayout] = useState({
    above: false,
    maxHeight: 384,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const searchId = useId();
  const selectedName = categories.find(
    (category) => category.slug === selectedCategory,
  )?.name;
  const normalizedQuery = query.trim().normalize("NFKC").toLocaleLowerCase();
  const matchingCategories = categories.filter((category) =>
    category.name
      .normalize("NFKC")
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );

  useLayoutEffect(() => {
    if (isOpen && listRef.current) listRef.current.scrollTop = 0;
  }, [isOpen, query]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    function positionPanel() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const viewport = window.visualViewport;
      const viewportOffset = viewport?.offsetTop ?? 0;
      const viewportBottom =
        viewportOffset + (viewport?.height ?? window.innerHeight);
      // An upward-opening panel must stay below the sticky storefront header.
      const headerBottom =
        document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      const viewportTop = Math.max(viewportOffset, headerBottom);
      const rect = trigger.getBoundingClientRect();
      const below = viewportBottom - rect.bottom - 16;
      const above = rect.top - viewportTop - 16;
      const openAbove = below < 240 && above > below;
      const maxHeight = Math.max(0, Math.min(384, openAbove ? above : below));
      setPanelLayout((current) =>
        current.above === openAbove && current.maxHeight === maxHeight
          ? current
          : { above: openAbove, maxHeight },
      );
    }

    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    window.visualViewport?.addEventListener("resize", positionPanel);
    window.visualViewport?.addEventListener("scroll", positionPanel);
    positionPanel();
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
      window.visualViewport?.removeEventListener("resize", positionPanel);
      window.visualViewport?.removeEventListener("scroll", positionPanel);
    };
  }, [isOpen]);

  function chooseCategory(slug: string | null) {
    onCategoryChange(slug);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={categoryLabel}
      className="flex max-w-full min-w-0 items-center gap-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-pressed={selectedCategory === null}
        onClick={() => {
          onCategoryChange(null);
          setIsOpen(false);
        }}
        className={`shrink-0 ${shortcutClass(selectedCategory === null)}`}
      >
        {allLabel}
      </button>

      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        {categories.slice(0, 3).map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={selectedCategory === category.slug}
            title={category.name}
            onClick={() => {
              onCategoryChange(category.slug);
              setIsOpen(false);
            }}
            className={`min-w-0 ${shortcutClass(selectedCategory === category.slug)}`}
          >
            <bdi className="block truncate">{category.name}</bdi>
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1 sm:max-w-64">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={
            selectedName
              ? `${allCategoriesLabel}: ${selectedName}`
              : allCategoriesLabel
          }
          title={selectedName ?? allCategoriesLabel}
          disabled={categories.length === 0}
          onClick={() => {
            setQuery("");
            setIsOpen((open) => !open);
          }}
          className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-4 py-2 text-start text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
        >
          <bdi className="min-w-0 truncate">
            {selectedName ?? allCategoriesLabel}
          </bdi>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <div
          id={panelId}
          hidden={!isOpen}
          style={{ maxHeight: panelLayout.maxHeight }}
          className={`absolute end-0 z-30 flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-card)] p-3 shadow-xl sm:w-80 lg:w-96 ${panelLayout.above ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
          <label htmlFor={searchId} className="sr-only">
            {searchCategoriesLabel}
          </label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchCategoriesLabel}
            className={`min-h-11 w-full min-w-0 shrink-0 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] ${focusRing}`}
          />

          <div
            ref={listRef}
            className="mt-3 max-h-72 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain px-1 py-1"
          >
            <button
              type="button"
              aria-pressed={selectedCategory === null}
              onClick={() => chooseCategory(null)}
              className={`mb-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-semibold wrap-anywhere ${focusRing} ${selectedCategory === null ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--ink)] hover:bg-[var(--surface-muted)]"}`}
            >
              <span className="min-w-0 flex-1">{allLabel}</span>
              {selectedCategory === null ? (
                <span aria-hidden="true">✓</span>
              ) : null}
            </button>
            {matchingCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={selectedCategory === category.slug}
                onClick={() => chooseCategory(category.slug)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm wrap-anywhere ${focusRing} ${selectedCategory === category.slug ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]" : "text-[var(--ink)] hover:bg-[var(--surface-muted)]"}`}
              >
                <bdi className="min-w-0 flex-1">{category.name}</bdi>
                {selectedCategory === category.slug ? (
                  <span aria-hidden="true">✓</span>
                ) : null}
              </button>
            ))}
            {matchingCategories.length === 0 ? (
              <p
                role="status"
                className="px-3 py-4 text-sm text-[var(--ink-muted)]"
              >
                {noCategoriesLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
