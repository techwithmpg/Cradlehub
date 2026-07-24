import {
  AlertTriangle,
  CalendarClock,
  Database,
  MapPin,
  ShieldCheck,
  Smartphone,
  UserRoundCog,
  Wrench,
} from "lucide-react";
import { AttendancePreventionCard } from "@/components/features/attendance/review/attendance-prevention-card";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type {
  AttendanceRecord,
  AttendanceScanEvent,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function EvidenceRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3 rounded-lg border border-[var(--cs-border-soft)] bg-white p-3">
      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--cs-surface-warm)]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-[var(--cs-text)]">{value}</div>
      </div>
    </div>
  );
}

function supportReceipt(item: AttendanceReviewItem): string {
  return `ATD-${item.exception.id.replaceAll("-", "").slice(-8).toUpperCase()}`;
}

export function AttendanceIssueSummary({
  data,
  item,
  record,
  scanEvent,
  instruction,
  onSaved,
}: {
  data: AttendanceWorkspaceData;
  item: AttendanceReviewItem;
  record: AttendanceRecord | null;
  scanEvent: AttendanceScanEvent | null;
  instruction: string;
  onSaved?: () => void;
}) {
  const diagnostic = item.diagnostic;
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-amber-950">{diagnostic.crmSummary}</p>
            <p className="mt-1 text-sm leading-6 text-amber-900">{item.exception.message}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <EvidenceRow
          icon={CalendarClock}
          label="Detected"
          value={formatDateTime(
            item.exception.last_detected_at ?? item.exception.detected_at,
            data.timezone
          )}
        />
        <EvidenceRow icon={MapPin} label="Branch" value={data.branchName} />
        <EvidenceRow
          icon={Smartphone}
          label="Saved scan"
          value={
            scanEvent
              ? `${formatDateTime(scanEvent.created_at, data.timezone)} · ${scanEvent.point_label ?? "Attendance QR"}`
              : "No saved scan is linked"
          }
        />
        <EvidenceRow
          icon={Database}
          label="Attendance record"
          value={
            record
              ? `${record.shift_date} · ${record.status.replaceAll("_", " ")}`
              : "No Attendance record exists"
          }
        />
        <EvidenceRow
          icon={ShieldCheck}
          label="Attendance changed"
          value={
            diagnostic.attendanceChanged
              ? "Yes — review the recorded change"
              : "No — record protected"
          }
        />
        <EvidenceRow
          icon={UserRoundCog}
          label="Resolution owner"
          value={diagnostic.resolutionOwner.replaceAll("_", " ")}
        />
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
        <div className="grid gap-1">
          <strong>Attendance help receipt</strong>
          <span>Problem code: {diagnostic.code.toUpperCase()}</span>
          <span>Receipt: {supportReceipt(item)}</span>
          <span>Occurrences: {item.recurrenceCount}</span>
          <span>Current status: {item.exception.resolution_status ?? item.exception.status}</span>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex gap-3">
          <Wrench className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-emerald-950">Fix this incident</p>
            <p className="mt-1 text-sm leading-6 text-emerald-900">{instruction}</p>
            <p className="mt-2 text-sm font-semibold text-emerald-950">
              Immediate outcome: {diagnostic.immediateResolution}
            </p>
          </div>
        </div>
      </div>

      <AttendancePreventionCard item={item} onSaved={onSaved} />

      <details className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-xs">
        <summary className="cursor-pointer font-bold">View technical evidence</summary>
        <div className="mt-3 grid gap-1 break-all text-[var(--cs-text-muted)]">
          <div>Exception type: {item.exception.exception_type}</div>
          <div>Safe error code: {item.exception.safe_error_code ?? diagnostic.code}</div>
          <div>Exception ID: {item.exception.id}</div>
          <div>Scan event ID: {item.exception.scan_event_id ?? "none"}</div>
          <div>Attendance record ID: {item.exception.checkin_id ?? "none"}</div>
          <div>Related incident rows: {item.relatedExceptionIds.length}</div>
          <div>Reason code: {scanEvent?.reason_code ?? "none"}</div>
        </div>
      </details>
    </div>
  );
}
