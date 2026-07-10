"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { QrPointListCard } from "@/components/features/attendance/qr-codes/qr-point-list";
import { QrSelectedPanel } from "@/components/features/attendance/qr-codes/qr-selected-panel";
import { QrToolbar, type QrStatusFilter, type QrTypeFilter } from "@/components/features/attendance/qr-codes/qr-toolbar";
import { downloadQrSvg, printQrPoints } from "@/components/features/attendance/qr-codes/qr-export-client";
import { deactivateQrPointAction, ensureAttendanceQrAction, ensureRoomQrPointsAction, type AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import { QR_PRINT_LAYOUTS, type QrPrintFormat } from "@/lib/attendance/qr-print-layout";
import type { AttendanceQrPoint, AttendanceWorkspaceData } from "@/lib/attendance/types";

const FORMAT_OPTIONS = Object.values(QR_PRINT_LAYOUTS);

export function QrCodesTab({
  data,
  nowMs,
  selectedQrId,
  selectedFormat,
  onSelectedQrChange,
  onFormatChange,
  onActionResult,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  selectedQrId: string | null;
  selectedFormat: QrPrintFormat;
  onSelectedQrChange: (id: string) => void;
  onFormatChange: (format: QrPrintFormat) => void;
  onActionResult: (result: AttendanceActionResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<QrTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<QrStatusFilter>("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(selectedQrId ? [selectedQrId] : []));
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.qrPoints.filter((point) => {
      const searchText = `${point.label} ${point.description ?? ""} ${point.resource_name ?? ""}`.toLowerCase();
      const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
      const matchesType = typeFilter === "all" || point.point_type === typeFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? point.is_active : !point.is_active);
      return matchesQuery && matchesType && matchesStatus;
    });
  }, [data.qrPoints, query, statusFilter, typeFilter]);

  const selectedQr = data.qrPoints.find((point) => point.id === selectedQrId) ?? rows[0] ?? data.qrPoints[0] ?? null;
  const bulkPoints = getSelectedQrPoints(data.qrPoints, selectedIds, selectedQr);
  const urlActionsDisabled = !data.qrConfiguration.isConfigured;

  function runAction(action: () => Promise<AttendanceActionResult>) {
    startTransition(async () => {
      try {
        onActionResult(await action());
      } catch {
        onActionResult({ ok: false, tab: "qr", message: "QR action failed. Please try again." });
      }
    });
  }

  function selectQr(id: string) {
    onSelectedQrChange(id);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const allVisibleSelected = rows.length > 0 && rows.every((point) => current.has(point.id));
      if (allVisibleSelected) return new Set([...current].filter((id) => !rows.some((point) => point.id === id)));
      return new Set([...current, ...rows.map((point) => point.id)]);
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function deactivateSelected(point: AttendanceQrPoint) {
    if (!window.confirm(`Deactivate ${point.label}? Existing printed signs will stop working.`)) return;
    const formData = new FormData();
    formData.set("qrPointId", point.id);
    runAction(() => deactivateQrPointAction(formData));
  }

  function exportSelected() {
    if (urlActionsDisabled) {
      toast.error("QR links are unavailable until APP_URL or NEXT_PUBLIC_APP_URL is configured.");
      return;
    }
    if (bulkPoints.length === 0) {
      toast.error("Select a QR point to export.");
      return;
    }
    bulkPoints.forEach((point) => downloadQrSvg({ point, branchName: data.branchName, format: selectedFormat }));
    toast.success(`${bulkPoints.length} QR ${bulkPoints.length === 1 ? "file" : "files"} exported.`);
  }

  function printSelected() {
    if (urlActionsDisabled) {
      toast.error("QR links are unavailable until APP_URL or NEXT_PUBLIC_APP_URL is configured.");
      return;
    }
    if (bulkPoints.length === 0) {
      toast.error("Select a QR point to print.");
      return;
    }
    printQrPoints({ points: bulkPoints, branchName: data.branchName, format: selectedFormat });
  }

  return (
    <div className="grid gap-4">
      {urlActionsDisabled ? (
        <div className="rounded-lg border border-amber-700/25 bg-[#FFF7E8] px-4 py-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <div className="grid gap-1">
              <div className="font-bold">QR links are temporarily unavailable</div>
              <p className="m-0 leading-5">
                Configure APP_URL or NEXT_PUBLIC_APP_URL in the Production environment using the canonical Cradle domain, then redeploy.
              </p>
              {data.qrConfiguration.error ? (
                <p className="m-0 text-xs text-amber-800">{data.qrConfiguration.error}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <QrToolbar
        branchName={data.branchName}
        query={query}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        isPending={isPending}
        onQueryChange={setQuery}
        onTypeFilterChange={setTypeFilter}
        onStatusFilterChange={setStatusFilter}
        onGenerateMissing={() => runAction(ensureRoomQrPointsAction)}
        onGenerateQr={() => runAction(ensureAttendanceQrAction)}
        onExportSelected={exportSelected}
        onPrintSelected={printSelected}
        urlActionsDisabled={urlActionsDisabled}
      />

      <div className="grid gap-4 xl:grid-cols-[0.47fr_0.53fr]">
        <QrPointListCard
          rows={rows}
          scanEvents={data.scanEvents}
          nowMs={nowMs}
          selectedQrId={selectedQr?.id ?? null}
          selectedIds={selectedIds}
          totalCount={data.qrPoints.length}
          onSelectQr={selectQr}
          onToggleSelection={toggleSelection}
          onToggleAllVisible={toggleAllVisible}
          onClearSelection={clearSelection}
        />

        {selectedQr ? (
          <QrSelectedPanel
            qrPoint={selectedQr}
            branchName={data.branchName}
            scanEvents={data.scanEvents}
            nowMs={nowMs}
            format={selectedFormat}
            formatOptions={FORMAT_OPTIONS}
            isPending={isPending}
            urlActionsDisabled={urlActionsDisabled || !selectedQr.scan_url}
            onFormatChange={onFormatChange}
            onDeactivate={deactivateSelected}
          />
        ) : null}
      </div>
    </div>
  );
}

function getSelectedQrPoints(points: AttendanceQrPoint[], selectedIds: Set<string>, selectedQr: AttendanceQrPoint | null): AttendanceQrPoint[] {
  const selected = points.filter((point) => selectedIds.has(point.id));
  if (selected.length > 0) return selected;
  return selectedQr ? [selectedQr] : [];
}
