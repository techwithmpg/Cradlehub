import type { ReactNode } from "react";

type CrmOperationalPageShellProps = {
  title: string;
  description?: string;
  context?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  support?: ReactNode;
  children: ReactNode;
};

export function CrmOperationalPageShell({
  title,
  description,
  context,
  actions,
  tabs,
  support,
  children,
}: CrmOperationalPageShellProps) {
  return (
    <section className="space-y-5">
      <header className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {context ? (
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
                {context}
              </div>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-text)]">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm text-[var(--cs-text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>

      {tabs ? <div>{tabs}</div> : null}

      {support ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <main className="min-w-0">{children}</main>
          <aside className="min-w-0">{support}</aside>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
