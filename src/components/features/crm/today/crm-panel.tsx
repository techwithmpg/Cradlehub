import type { CSSProperties, ReactNode } from "react";
import { CrmSectionCard } from "@/components/features/crm/shared/crm-cards";
import { cn } from "@/lib/utils";

export function CrmPanel({
  title,
  action,
  children,
  className = "",
  style,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  if (style) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-2xs",
          className
        )}
        style={style}
      >
        {(title || action) && (
          <div className="flex items-center justify-between gap-3">
            {title && (
              <div className="text-sm font-bold tracking-tight text-[var(--cs-text)]">
                {title}
              </div>
            )}
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <CrmSectionCard title={title} actions={action} className={className} compact>
      {children}
    </CrmSectionCard>
  );
}
