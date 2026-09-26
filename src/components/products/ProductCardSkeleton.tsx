export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-[var(--line-soft)] bg-[var(--surface-card)] shadow-sm">
      <div className="aspect-square animate-pulse bg-[var(--surface-muted)]" />

      <div className="space-y-3 p-3 sm:p-5">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        <div className="h-5 w-3/4 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        <div className="min-h-[3.25rem] border-t border-[var(--line-soft)] pt-3">
          <div className="h-5 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="mt-2 h-4 w-16 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}
