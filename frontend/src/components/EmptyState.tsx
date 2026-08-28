export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-bf-border bg-bf-panel/40 px-6 py-16 text-center">
      <div className="text-3xl">⌁</div>
      <h3 className="text-sm font-semibold text-bf-green-muted">{title}</h3>
      <p className="max-w-sm text-xs text-bf-green-muted/60">{description}</p>
    </div>
  );
}
