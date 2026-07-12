import {
  AlertTriangle,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Panel,
  StatusPill,
  formatAttendanceDateTime,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

function getBlockedScanCount(data: AttendanceWorkspaceData): number {
  return data.scanEvents.filter(
    (event) =>
      event.outcome === "blocked" ||
      event.outcome === "error" ||
      event.reason_code === "device_not_registered" ||
      event.message?.toLowerCase().includes("no registered device")
  ).length;
}

function getNotArrivedCount(data: AttendanceWorkspaceData): number {
  const activeStaffIds = new Set(
    data.records
      .filter((record) => record.status === "checked_in" && !record.checked_out_at)
      .map((record) => record.staff_id)
  );

  return data.staffOptions.filter((staff) => !activeStaffIds.has(staff.id)).length;
}

export function AttentionExceptions({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const openExceptions = data.exceptions.filter((exception) => exception.status === "open");
  const blockedScans = getBlockedScanCount(data);
  const notArrived = getNotArrivedCount(data);

  const actionItems = [
    {
      id: "blocked-scans",
      title: `${blockedScans} blocked scan${blockedScans === 1 ? "" : "s"} from unregistered device`,
      detail: blockedScans > 0 ? "Device setup or phone activation needed." : "No blocked scans.",
      icon: AlertTriangle,
      tone: blockedScans > 0 ? "bad" : "good",
      tab: "devices" as AttendanceTab,
    },
    {
      id: "not-arrived",
      title: `${notArrived} staff not arrived`,
      detail: "Scheduled staff who have not started attendance yet.",
      icon: ShieldCheck,
      tone: notArrived > 0 ? "warn" : "good",
      tab: "records" as AttendanceTab,
    },
    {
      id: "recovery",
      title: `${openExceptions.length} active recovery item${openExceptions.length === 1 ? "" : "s"}`,
      detail: openExceptions.length > 0 ? "Review scan or attendance corrections." : "Attendance recovery is clear.",
      icon: Wrench,
      tone: openExceptions.length > 0 ? "warn" : "good",
      tab: "exceptions" as AttendanceTab,
    },
  ];

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Today Action Center
          {blockedScans + openExceptions.length > 0 ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {blockedScans + openExceptions.length}
            </span>
          ) : null}
        </span>
      }
      className="rounded-2xl"
    >
      <div className="grid gap-2">
        {actionItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.tab)}
              className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:border-emerald-800 ${
                item.tone === "bad"
                  ? "border-red-100 bg-red-50"
                  : item.tone === "warn"
                    ? "border-amber-100 bg-amber-50"
                    : "border-emerald-100 bg-emerald-50"
              }`}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-full ${
                  item.tone === "bad"
                    ? "bg-red-100 text-red-700"
                    : item.tone === "warn"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
              </span>
              <span className="text-lg text-muted-foreground">›</span>
            </button>
          );
        })}
      </div>

      {openExceptions.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {openExceptions.slice(0, 3).map((exception) => (
            <div key={exception.id} className="rounded-2xl border border-border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">
                    {exception.staff_name ?? "Unassigned device"}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {humanizeAttendanceValue(exception.exception_type)} ·{" "}
                    {formatAttendanceDateTime(exception.detected_at)}
                  </div>
                </div>
                <StatusPill
                  value={exception.severity}
                  tone={exception.severity === "critical" ? "bad" : "warn"}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{exception.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => onTabChange("devices")}>
          <ShieldCheck data-icon="inline-start" />
          Activate Phone
        </Button>
        <Button type="button" variant="outline" onClick={() => onTabChange("exceptions")}>
          <Wrench data-icon="inline-start" />
          Open Recovery
        </Button>
        <Button type="button" variant="outline" onClick={() => onTabChange("qr")}>
          <QrCode data-icon="inline-start" />
          QR Codes
        </Button>
        <Button type="button" variant="outline" onClick={() => onTabChange("records")}>
          <ClipboardList data-icon="inline-start" />
          Records
        </Button>
      </div>

      {blockedScans + openExceptions.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" />
          Attendance operations are clear right now.
        </div>
      ) : null}
    </Panel>
  );
}
