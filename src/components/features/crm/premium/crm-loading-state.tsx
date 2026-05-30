/**
 * CrmLoadingState — combined premium loader + optional skeleton shimmer.
 *
 * Layout (top → bottom):
 *   1. CrmPremiumLoader  (centered, communicates "active preparation")
 *   2. CrmLoadingShimmer (below, communicates "this is what's coming")
 *
 * Use for: full CRM route loading, setup readiness scan, heavy section waits.
 *
 * Do NOT use for:
 *   – Button/row save actions (use CrmInlineActionButton)
 *   – Toggle / modal save loading (use local spinner)
 *   – Any small inline action that must feel fast
 *
 * shimmer="none" shows only the loader (suitable when content shape is unknown).
 */

import { cn } from "@/lib/utils";
import { CrmPremiumLoader } from "./crm-premium-loader";
import type { CrmPremiumLoaderProps } from "./crm-premium-loader";
import { CrmLoadingShimmer } from "./crm-loading-shimmer";

export type CrmLoadingStateProps = {
  title?: string;
  subtitle?: string;
  loaderSize?: CrmPremiumLoaderProps["size"];
  /** Which shimmer layout to show below the loader. "none" = loader only. */
  shimmer?: "kpi-row" | "table" | "rail" | "card-grid" | "none";
  /** Rows for "table" shimmer variant */
  rows?: number;
  /** Columns for "kpi-row" and "card-grid" shimmer variants */
  cols?: number;
  className?: string;
};

export function CrmLoadingState({
  title,
  subtitle,
  loaderSize = "md",
  shimmer    = "none",
  rows,
  cols,
  className,
}: CrmLoadingStateProps) {
  return (
    <div
      className={cn("flex flex-col", className)}
    >
      {/* Premium animated loader – centered in its zone */}
      <div className="flex items-center justify-center py-4">
        <CrmPremiumLoader
          title={title}
          subtitle={subtitle}
          size={loaderSize}
        />
      </div>

      {/* Skeleton shimmer below – shows content structure while data loads */}
      {shimmer !== "none" && (
        <div className="mt-2">
          <CrmLoadingShimmer
            variant={shimmer}
            rows={rows}
            cols={cols}
          />
        </div>
      )}
    </div>
  );
}
