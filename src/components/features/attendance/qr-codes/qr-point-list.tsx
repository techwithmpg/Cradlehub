import { MoreVertical, QrCode } from "lucide-react";
import { EmptyState, StatusPill } from "@/components/features/attendance/attendance-ui";
import { formatLastScanned, getLatestScanEvent, getQrPointSubtitle, getQrPointTypeLabel } from "@/components/features/attendance/qr-codes/qr-display";
import { cn } from "@/lib/utils";
import type { AttendanceQrPoint, AttendanceScanEvent } from "@/lib/attendance/types";

export function QrPointListCard({
  rows,
  scanEvents,
  nowMs,
  selectedQrId,
  selectedIds,
  totalCount,
  onSelectQr,
  onToggleSelection,
  onToggleAllVisible,
  onClearSelection,
}: {
  rows: AttendanceQrPoint[];
  scanEvents: AttendanceScanEvent[];
  nowMs: number;
  selectedQrId: string | null;
  selectedIds: Set<string>;
  totalCount: number;
  onSelectQr: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onToggleAllVisible: () => void;
  onClearSelection: () => void;
}) {
  const allVisibleSelected = rows.length > 0 && rows.every((point) => selectedIds.has(point.id));

  return (
    <section className="cs-card grid min-w-0 content-start gap-3 rounded-lg p-4">
      <h2 className="m-0 text-[0.98rem] font-bold text-foreground">QR Points ({rows.length})</h2>

      {rows.length === 0 ? (
        <EmptyState title="No QR points found." detail="Generate the attendance QR or missing room QRs to begin." />
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-stone-50 text-left text-[11px] text-muted-foreground">
                <th className="w-10 rounded-l-md px-3 py-2 font-semibold">
                  <input aria-label="Select all visible QR points" type="checkbox" checked={allVisibleSelected} onChange={onToggleAllVisible} className="accent-[#9A6A28]" />
                </th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="w-24 px-3 py-2 font-semibold">Type</th>
                <th className="w-24 px-3 py-2 font-semibold">Status</th>
                <th className="w-28 px-3 py-2 font-semibold">Last Scanned</th>
                <th className="w-10 rounded-r-md px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((point) => {
                const selected = selectedQrId === point.id;
                const latestScan = formatLastScanned(getLatestScanEvent(point, scanEvents)?.created_at, nowMs);
                return (
                  <tr key={point.id} className={cn("border-b last:border-b-0", selected && "bg-[#FBF4E4] shadow-[inset_0_0_0_1px_rgba(191,149,74,0.35)]")}>
                    <td className="border-b border-border/70 px-3 py-3">
                      <input
                        aria-label={`Select ${point.label}`}
                        type="checkbox"
                        checked={selectedIds.has(point.id)}
                        onChange={() => onToggleSelection(point.id)}
                        className="accent-[#9A6A28]"
                      />
                    </td>
                    <td className="border-b border-border/70 px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-white", point.is_active ? "bg-[#167146]" : "bg-slate-300 text-slate-600")}>
                          <QrCode className="size-4" />
                        </span>
                        <button type="button" className="min-w-0 text-left" onClick={() => onSelectQr(point.id)}>
                          <span className="block truncate text-[13px] font-bold text-foreground">{point.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{getQrPointSubtitle(point)}</span>
                        </button>
                      </div>
                    </td>
                    <td className="border-b border-border/70 px-3 py-3"><StatusPill value={getQrPointTypeLabel(point)} tone={point.point_type === "attendance" ? "good" : "neutral"} /></td>
                    <td className="border-b border-border/70 px-3 py-3"><StatusPill value={point.is_active ? "Active" : "Inactive"} tone={point.is_active ? "good" : "neutral"} /></td>
                    <td className="border-b border-border/70 px-3 py-3 text-xs text-muted-foreground">
                      <span className="block text-foreground/80">{latestScan.primary}</span>
                      <span>{latestScan.secondary}</span>
                    </td>
                    <td className="border-b border-border/70 px-3 py-3"><MoreVertical className="size-4 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
            <span>{selectedIds.size} of {totalCount} selected</span>
            <button type="button" className="font-semibold text-[#0B5634]" onClick={onClearSelection}>Clear selection</button>
          </div>
        </div>
      )}
    </section>
  );
}
