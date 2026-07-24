"use client";

import { AttendanceBranchDialog } from "@/components/features/attendance/review/attendance-branch-dialog";
import { AttendanceCorrectionDialog } from "@/components/features/attendance/review/attendance-correction-dialog";
import { AttendanceScheduleDialog } from "@/components/features/attendance/review/attendance-schedule-dialog";
import { AttendanceTechnicalDialog } from "@/components/features/attendance/review/attendance-technical-dialog";
import { ResolveAttendanceScanDialog } from "@/components/features/attendance/review/resolve-attendance-scan-dialog";
import { RecoveryLinkDialog } from "@/components/features/attendance/devices/recovery-link-dialog";
import { attendanceReviewResolutionKind } from "@/lib/attendance/review-resolution";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type {
  AttendanceRecord,
  AttendanceScanEvent,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

export function AttendanceIssueModalRouter({
  data,
  item,
  onClose,
  onRefresh,
  onManagePhone,
}: {
  data: AttendanceWorkspaceData;
  item: AttendanceReviewItem | null;
  onClose: () => void;
  onRefresh: () => void;
  onManagePhone: (staffId: string | null) => void;
}) {
  if (!item) return null;

  const record: AttendanceRecord | null = item.exception.checkin_id
    ? (data.records.find((row) => row.id === item.exception.checkin_id) ?? null)
    : null;
  const scanEvent: AttendanceScanEvent | null = item.exception.scan_event_id
    ? (data.scanEvents.find((row) => row.id === item.exception.scan_event_id) ?? null)
    : null;
  const kind = attendanceReviewResolutionKind({
    item,
    record,
    scanEvent,
  });
  const common = {
    open: true,
    onOpenChange: (open: boolean) => {
      if (!open) onClose();
    },
    onSaved: () => {
      onRefresh();
      onClose();
    },
  };

  if (kind === "correct_record") {
    return (
      <AttendanceCorrectionDialog
        key={`${item.id}-${record?.id ?? "none"}`}
        {...common}
        branchId={data.branchId}
        timezone={data.timezone}
        record={record}
        exception={item.exception}
      />
    );
  }

  if (kind === "resolve_scan") {
    return (
      <ResolveAttendanceScanDialog
        key={`${item.id}-${scanEvent?.id ?? item.exception.scan_event_id ?? "scan"}`}
        {...common}
        data={data}
        item={item}
        scanEvent={scanEvent}
      />
    );
  }

  if (kind === "schedule") {
    return (
      <AttendanceScheduleDialog
        key={item.id}
        {...common}
        data={data}
        item={item}
        scanEvent={scanEvent}
      />
    );
  }

  if (kind === "branch") {
    return (
      <AttendanceBranchDialog
        key={item.id}
        {...common}
        data={data}
        item={item}
        scanEvent={scanEvent}
      />
    );
  }

  if (kind === "phone" && item.exception.staff_id) {
    const entry =
      data.deviceRegistry.entries.find((row) => row.staffId === item.exception.staff_id) ?? null;
    return (
      <RecoveryLinkDialog
        key={item.id}
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        registry={data.deviceRegistry}
        entry={entry}
        initialStaffId={item.exception.staff_id}
        onGenerated={() => onRefresh()}
      />
    );
  }

  return (
    <AttendanceTechnicalDialog
      key={item.id}
      {...common}
      data={data}
      item={item}
      record={record}
      scanEvent={scanEvent}
      onOpenPhoneSetup={
        kind === "phone"
          ? () => {
              onClose();
              onManagePhone(item.exception.staff_id);
            }
          : undefined
      }
    />
  );
}
