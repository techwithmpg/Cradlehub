import { cn } from "@/lib/utils";

type CrmTableShellProps = {
  /** Rendered above the table (e.g. column actions, summary row) */
  header?: React.ReactNode;
  /** Table element (<table className="cs-table">) */
  children: React.ReactNode;
  /** Shown instead of children when isEmpty is true */
  emptyState?: React.ReactNode;
  /** Rendered below the table (e.g. pagination controls) */
  pagination?: React.ReactNode;
  /** When true, renders emptyState instead of children */
  isEmpty?: boolean;
  className?: string;
};

/**
 * Visual wrapper for CRM tables.
 * Uses .cs-table-wrap as the base surface.
 * Slot-based: header, children (table), emptyState, pagination.
 * Does not replace table logic – only wraps the visual container.
 */
export function CrmTableShell({
  header,
  children,
  emptyState,
  pagination,
  isEmpty,
  className,
}: CrmTableShellProps) {
  return (
    <div className={cn("cs-table-wrap", className)}>
      {header && (
        <div className="border-b border-[var(--cs-border-soft)] px-4 py-3">
          {header}
        </div>
      )}

      {isEmpty === true && emptyState != null ? emptyState : children}

      {pagination && (
        <div className="border-t border-[var(--cs-border-soft)] px-4 py-3">
          {pagination}
        </div>
      )}
    </div>
  );
}
