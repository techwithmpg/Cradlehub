"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Smartphone, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  applyAttendanceCorrectionAction,
  escalateAttendanceIssueAction,
  resolveAttendanceExceptionAction,
} from "@/app/(dashboard)/crm/attendance/actions";
import { AttendanceCorrectionDialog } from "@/components/features/attendance/review/attendance-correction-dialog";
import { AttendanceScheduleDialog } from "@/components/features/attendance/review/attendance-schedule-dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceRecord, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttendanceReviewDrawer({
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
  const [dialog, setDialog] = useState<"correct" | "schedule" | "confirm" | "resolve" | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const record: AttendanceRecord | null = item?.exception.checkin_id
    ? (data.records.find((row) => row.id === item.exception.checkin_id) ?? null)
    : null;

  function confirmRecommended() {
    if (!item) return;
    if (item.category === "clock") return setDialog("correct");
    if (item.category === "schedule") return setDialog("schedule");
    if (item.category === "phone") return onManagePhone(item.exception.staff_id);
    setDialog("confirm");
  }

  function runConfirmed() {
    if (!item) return;
    startTransition(async () => {
      const result =
        item.category === "branch"
          ? await applyAttendanceCorrectionAction({
              branchId: data.branchId,
              actionType: "allow_branch_today",
              exceptionId: item.exception.id,
              checkinId: item.exception.checkin_id,
              staffId: item.exception.staff_id,
              attendanceDate: data.businessDate,
              targetBranchId: data.branchId,
              reason: "Confirmed for this branch today",
            })
          : await escalateAttendanceIssueAction(item.exception.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setDialog(null);
      onRefresh();
      onClose();
    });
  }

  function resolve() {
    if (!item || note.trim().length < 3) return;
    startTransition(async () => {
      const form = new FormData();
      form.set("exceptionId", item.exception.id);
      form.set("resolutionNote", note.trim());
      const result = await resolveAttendanceExceptionAction(form);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Incident resolved.");
      setDialog(null);
      onRefresh();
      onClose();
    });
  }

  return (
    <>
      <Sheet
        open={Boolean(item)}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto bg-[var(--cs-surface)] p-0 sm:max-w-lg"
        >
          {item ? (
            <>
              <SheetHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-14">
                <SheetTitle>{item.title}</SheetTitle>
                <SheetDescription>
                  {item.exception.staff_name ?? "Unknown staff"} · {item.category} incident
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 p-5">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 size-5 text-amber-700" />
                    <div>
                      <p className="text-sm font-bold text-amber-950">What happened</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900">
                        {item.exception.message}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <Detail
                    icon={CalendarClock}
                    label="Detected"
                    value={new Intl.DateTimeFormat("en-US", {
                      timeZone: data.timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.exception.detected_at))}
                  />
                  <Detail
                    icon={Smartphone}
                    label="Linked record"
                    value={
                      record
                        ? `${record.shift_date} · ${record.status}`
                        : "No attendance record linked"
                    }
                  />
                  <Detail icon={Wrench} label="Recommended" value={item.recommendedAction} />
                </div>
                <Button onClick={confirmRecommended}>{item.recommendedAction}</Button>
                <Button variant="outline" onClick={() => setDialog("resolve")}>
                  <CheckCircle2 />
                  Resolve with note
                </Button>
                <details className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-xs">
                  <summary className="cursor-pointer font-bold">Technical details</summary>
                  <div className="mt-2 grid gap-1 break-all text-[var(--cs-text-muted)]">
                    <div>Type: {item.exception.exception_type}</div>
                    <div>Exception: {item.exception.id}</div>
                    <div>Related rows: {item.relatedExceptionIds.length}</div>
                  </div>
                </details>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <AttendanceCorrectionDialog
        key={`${record?.id ?? "none"}-${item?.id ?? "none"}`}
        open={dialog === "correct"}
        onOpenChange={(open) => setDialog(open ? "correct" : null)}
        branchId={data.branchId}
        timezone={data.timezone}
        record={record}
        exception={item?.exception ?? null}
        onSaved={() => {
          onRefresh();
          onClose();
        }}
      />
      <AttendanceScheduleDialog
        key={item?.id ?? "none"}
        open={dialog === "schedule"}
        onOpenChange={(open) => setDialog(open ? "schedule" : null)}
        branchId={data.branchId}
        staffId={item?.exception.staff_id ?? null}
        staffName={item?.exception.staff_name ?? "staff member"}
        date={data.businessDate}
        onSaved={() => {
          onRefresh();
          onClose();
        }}
      />
      <AlertDialog
        open={dialog === "confirm"}
        onOpenChange={(open) => setDialog(open ? "confirm" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {item?.category === "branch"
                ? "Allow this branch today?"
                : "Escalate technical issue?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {item?.category === "branch"
                ? "The staff member can scan at this branch for the rest of today. Their permanent branch is unchanged."
                : "This creates an owner-facing technical task without exposing raw error details to staff."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed} disabled={pending}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={dialog === "resolve"}
        onOpenChange={(open) => setDialog(open ? "resolve" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve incident?</AlertDialogTitle>
            <AlertDialogDescription>
              Add a short note so the decision remains auditable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Resolution note"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resolve} disabled={pending || note.trim().length < 3}>
              Resolve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3 rounded-lg border border-[var(--cs-border-soft)] p-3">
      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--cs-surface-warm)]">
        <Icon className="size-4" />
      </span>
      <div>
        <div className="text-xs font-bold text-[var(--cs-text-muted)]">{label}</div>
        <div className="mt-0.5 font-semibold">{value}</div>
      </div>
    </div>
  );
}
