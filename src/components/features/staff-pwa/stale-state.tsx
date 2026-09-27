import { Clock, RefreshCw } from "lucide-react";

type StaffStaleStateProps = {
  lastUpdatedLabel?: string | null;
  onRefresh?: () => void;
};

export function StaffStaleState({
  lastUpdatedLabel,
  onRefresh,
}: StaffStaleStateProps) {
  return (
    <div
      role="note"
      className="flex items-center justify-between gap-2 rounded-xl bg-[#FFF4DB] border border-[#FEE199] px-3.5 py-2 text-xs text-[#654600]"
    >
      <div className="flex items-center gap-2">
        <Clock size={14} className="shrink-0" aria-hidden="true" />
        <span>
          {lastUpdatedLabel
            ? `Showing cached view from ${lastUpdatedLabel}`
            : "Showing previously loaded view (status unconfirmed)"}
        </span>
      </div>

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 active:scale-95"
        >
          <RefreshCw size={12} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      ) : null}
    </div>
  );
}
