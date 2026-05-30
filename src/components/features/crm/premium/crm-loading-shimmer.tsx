import { cn } from "@/lib/utils";

type CrmLoadingShimmerVariant = "kpi-row" | "table" | "rail" | "card-grid";

type CrmLoadingShimmerProps = {
  variant: CrmLoadingShimmerVariant;
  /** Number of rows for "table" variant */
  rows?: number;
  /** Number of columns/cards for "kpi-row" and "card-grid" variants */
  cols?: number;
  className?: string;
};

/** Single shimmer block – warm gradient sweep via global .crm-shimmer-wrap class */
function ShimmerBlock({ className }: { className?: string }) {
  return <div className={cn("crm-shimmer-wrap rounded-md", className)} />;
}

/**
 * Warm CRM skeleton loader.
 * Variants: kpi-row | table | rail | card-grid
 *
 * Colours derive from --cs-border-soft and --cs-surface-warm via the
 * .crm-shimmer-wrap global class. No grey generic skeletons.
 */
export function CrmLoadingShimmer({
  variant,
  rows = 8,
  cols = 5,
  className,
}: CrmLoadingShimmerProps) {
  if (variant === "kpi-row") {
    return (
      <div
        className={cn(
          "mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5",
          className
        )}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <ShimmerBlock key={i} className="h-[82px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("cs-table-wrap overflow-hidden", className)}>
        <ShimmerBlock className="h-10 rounded-none" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-t border-[var(--cs-border-soft)]">
            <ShimmerBlock className="h-[52px] rounded-none" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div className={cn("space-y-4 p-4", className)}>
        {/* Header avatar + name */}
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-4 w-2/3" />
            <ShimmerBlock className="h-3 w-1/3" />
          </div>
        </div>
        {/* Summary metric grid */}
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-[60px] rounded-lg" />
          ))}
        </div>
        {/* Recent activity rows */}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // card-grid
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <ShimmerBlock key={i} className="h-[120px] rounded-xl" />
      ))}
    </div>
  );
}
