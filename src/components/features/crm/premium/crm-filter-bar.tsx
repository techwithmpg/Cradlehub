import { cn } from "@/lib/utils";

type CrmFilterBarProps = {
  /** Left slot – search input(s) */
  searchSlot?: React.ReactNode;
  /** Centre slot – filter controls */
  filtersSlot?: React.ReactNode;
  /** Right slot – export/action buttons */
  actionsSlot?: React.ReactNode;
  className?: string;
};

/**
 * Consistent CRM search/filter/export toolbar.
 * Three named slots: searchSlot (left), filtersSlot (centre), actionsSlot (right).
 * Responsive: single column on mobile, flex row on sm+.
 */
export function CrmFilterBar({
  searchSlot,
  filtersSlot,
  actionsSlot,
  className,
}: CrmFilterBarProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {searchSlot && (
        <div className="flex flex-1 items-center gap-2 sm:max-w-md">
          {searchSlot}
        </div>
      )}

      {filtersSlot && (
        <div className="flex items-center gap-2">{filtersSlot}</div>
      )}

      {actionsSlot && (
        <div className="flex items-center gap-2">{actionsSlot}</div>
      )}
    </div>
  );
}
