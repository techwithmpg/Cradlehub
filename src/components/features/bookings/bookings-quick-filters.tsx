import type { BookingQuickFilter } from "@/lib/bookings/bookings-workspace-filters";
import { cn } from "@/lib/utils";

type QuickFilterItem = {
  key: BookingQuickFilter;
  label: string;
  count: number;
};

export function BookingsQuickFilters({
  items,
  activeFilter,
  onChange,
}: {
  items: QuickFilterItem[];
  activeFilter: BookingQuickFilter;
  onChange: (filter: BookingQuickFilter) => void;
}) {
  return (
    <div
      className="flex min-w-0 gap-7 overflow-x-auto border-b border-[var(--cs-border-soft)] px-5"
      aria-label="Booking quick filters"
    >
      {items.map((item) => {
        const isActive = item.key === activeFilter;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(item.key)}
            className={cn(
              "relative h-12 shrink-0 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-800",
              isActive
                ? "text-emerald-950 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-emerald-800"
                : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]"
            )}
          >
            {item.label} <span className="tabular-nums">{item.count}</span>
          </button>
        );
      })}
    </div>
  );
}
