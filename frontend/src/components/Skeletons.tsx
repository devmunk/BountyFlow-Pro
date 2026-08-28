export function BountyCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-bf-border bg-bf-panel p-4">
      <div className="mb-3 h-4 w-2/3 rounded bg-bf-border" />
      <div className="mb-2 h-3 w-full rounded bg-bf-border/70" />
      <div className="mb-4 h-3 w-4/5 rounded bg-bf-border/70" />
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 rounded-full bg-bf-border" />
        <div className="h-4 w-20 rounded bg-bf-border" />
      </div>
    </div>
  );
}

export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}
