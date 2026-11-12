"use client";

import { AttendanceTechnicalDialog } from "./attendance-technical-dialog";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceScanEvent, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function ResolveAttendanceScanDialog({
  open,
  onOpenChange,
  data,
  item,
  scanEvent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AttendanceWorkspaceData;
  item: AttendanceReviewItem;
  scanEvent: AttendanceScanEvent | null;
  onSaved: () => void;
}) {
  return (
    <AttendanceTechnicalDialog
      open={open}
      onOpenChange={onOpenChange}
      data={data}
      item={item}
      record={null}
      scanEvent={scanEvent}
      onSaved={onSaved}
    />
  );
}
