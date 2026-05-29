export function SetupSectionTitle({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-[var(--cs-text)]">
        {children}
      </h3>
      {count !== undefined && (
        <span className="rounded-full bg-[var(--cs-surface-raised)] border border-[var(--cs-border-soft)] px-2 py-0.5 text-[0.625rem] font-bold text-[var(--cs-text-muted)]">
          {count}
        </span>
      )}
    </div>
  );
}
