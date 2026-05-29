import Link from "next/link";

export function SetupShortcutCard({
  icon,
  label,
  description,
  href,
}: {
  icon: string;
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--cs-sand)] hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cs-surface-warm)] text-lg transition-colors group-hover:bg-[var(--cs-sand-mist)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--cs-text)]">{label}</span>
          <span className="ml-auto text-sm text-[var(--cs-text-muted)] transition-colors group-hover:text-[var(--cs-sand)]">
            ›
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--cs-text-muted)]">
          {description}
        </p>
      </div>
    </Link>
  );
}
