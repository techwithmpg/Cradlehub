import type { ReactNode } from "react";
import { CrmPageHeader } from "@/components/features/crm/shared/crm-page-header";

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
    <section className="space-y-4">
      <CrmPageHeader
        eyebrow={context}
        title={title}
        description={description}
        actions={actions}
      />

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
