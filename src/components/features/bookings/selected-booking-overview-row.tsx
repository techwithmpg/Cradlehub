export function SelectedBookingOverviewRow({
  icon,
  label,
  summary,
  action,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  summary: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--cs-border-soft)] last:border-b-0">
      <div className="grid grid-cols-[30px_130px_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3.5">
        <span className="text-[var(--cs-text-secondary)]">{icon}</span>
        <h3 className="text-sm font-semibold text-[var(--cs-text)]">{label}</h3>
        <div className="min-w-0 truncate text-xs text-[var(--cs-text-secondary)]">{summary}</div>
        {action ?? <span />}
      </div>
      {children ? <div className="border-t border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">{children}</div> : null}
    </section>
  );
}

export const overviewActionClass =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50";
