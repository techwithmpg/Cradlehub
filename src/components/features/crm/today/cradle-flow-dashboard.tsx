"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  crmStartServiceAction,
  markBookingArrivedAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { useAttendanceScanFeed } from "@/components/features/attendance/use-attendance-scan-feed";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import {
  getCradleFlowStage,
  type CradleFlowBooking,
} from "@/lib/crm/cradle-flow";
import type { AttendanceScanFeedData, RecentAttendanceScan } from "@/lib/attendance/types";
import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import { CradleFlowActions } from "./cradle-flow-actions";
import { CradleFlowBookingDialog } from "./cradle-flow-booking-dialog";
import { CradleFlowCheckoutDialog } from "./cradle-flow-checkout-dialog";
import { CradleFlowCompleteDialog } from "./cradle-flow-complete-dialog";
import { CradleFlowHeader } from "./cradle-flow-header";
import { CradleFlowSideRail } from "./cradle-flow-side-rail";
import {
  CradleFlowAttendanceDialog,
  CradleFlowDayTotalsDialog,
  CradleFlowReadinessDialog,
} from "./cradle-flow-support-dialogs";
import { CradleFlowWorkflow } from "./cradle-flow-workflow";
import { CashFlowEntryDialog } from "@/components/features/cash-flow/cash-flow-entry-dialog";
import { cn } from "@/lib/utils";

type MutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;
type ActiveDialog = "details" | "complete" | "checkout" | null;

type CradleFlowDashboardProps = {
  branchName: string;
  dateLabel: string;
  queueData: CradleFlowBooking[];
  snapshot: CrmTodaySnapshot;
  actionNotifications: { id: string; title: string; message?: string }[];
  attendanceScanFeed: AttendanceScanFeedData;
  attendanceScanDate: string;
  readinessIssues: ReadinessIssue[];
  readinessStatus: ReadinessStatus;
  paymentAction?: MutationAction;
  statusAction?: MutationAction;
};

export function CradleFlowDashboard(props: CradleFlowDashboardProps) {
  const [bookings, setBookings] = useState(props.queueData);
  const [selected, setSelected] = useState<CradleFlowBooking | null>(null);
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [attendance, setAttendance] = useState<RecentAttendanceScan | null>(null);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [cashFlowModalOpen, setCashFlowModalOpen] = useState(false);
  const [, setCollected] = useState(props.snapshot.payment?.total_collected ?? 0);
  const [isActing, startAction] = useTransition();

  const attendanceState = useAttendanceScanFeed({
    workspace: "crm",
    selectedDate: props.attendanceScanDate,
    branchId: props.attendanceScanFeed.branchId,
    initialFeed: props.attendanceScanFeed,
    maxItems: 6,
  });

  const pendingBooking =
    bookings.find((booking) => ["pending", "pending_crm_confirmation"].includes(booking.status)) ??
    null;

  function updateBooking(id: string, change: Partial<CradleFlowBooking>) {
    setBookings((current) =>
      current.map((booking) => (booking.id === id ? { ...booking, ...change } : booking))
    );
  }

  function openBooking(booking: CradleFlowBooking) {
    setSelected(booking);
    setDialog("details");
  }

  function runPrimary(booking: CradleFlowBooking) {
    const stage = getCradleFlowStage(booking);
    setSelected(booking);
    if (stage === "in_service") return setDialog("complete");
    if (stage === "ready_to_pay") return setDialog("checkout");
    if (stage === "completed" || booking.type === "home_service") {
      return setDialog("details");
    }
    startAction(async () => {
      let result: { success: boolean; error?: string };
      if (["pending", "pending_crm_confirmation"].includes(booking.status)) {
        result = props.statusAction
          ? await props.statusAction({ bookingId: booking.id, status: "confirmed" })
          : { success: false, error: "Confirmation action is unavailable." };
        if (result.success) updateBooking(booking.id, { status: "confirmed" });
      } else if (booking.booking_progress_status === "checked_in") {
        result = await crmStartServiceAction({ bookingId: booking.id });
        if (result.success) {
          updateBooking(booking.id, {
            status: "in_progress",
            booking_progress_status: "session_started",
            session_started_at: new Date().toISOString(),
          });
        }
      } else {
        result = await markBookingArrivedAction({ bookingId: booking.id });
        if (result.success) {
          updateBooking(booking.id, {
            booking_progress_status: "checked_in",
            checked_in_at: new Date().toISOString(),
          });
        }
      }
      if (!result.success) {
        toast.error(result.error ?? "Action could not be completed.");
        return;
      }
      notifyBookingsChanged();
      toast.success("Booking updated");
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3.5 p-3 sm:p-4 lg:p-5">
      {/* 1. Page Header (Today) */}
      <CradleFlowHeader />

      {/* 2. Quick Action Row (4 Cards) */}
      <CradleFlowActions pendingBooking={pendingBooking} onResumePending={openBooking} />

      {/* 3. Main Workspace: Left (Active Service Workflow) vs Right Operations Rail */}
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_310px] 2xl:grid-cols-[1fr_340px] xl:h-[calc(100vh-235px)] xl:min-h-[560px]">
        {/* Left Column: Active Service Workflow (Full workstation height with internal scroll) */}
        <main className={cn("min-w-0 xl:h-full xl:min-h-0", isActing && "opacity-80")}>
          <CradleFlowWorkflow
            bookings={bookings}
            staffAvailable={props.snapshot.staffReadiness.availableNow}
            pendingFollowUps={props.actionNotifications.length}
            onOpen={openBooking}
            onPrimary={runPrimary}
          />
        </main>

        {/* Right Operations Rail */}
        <CradleFlowSideRail
          branchName={props.branchName}
          attendanceDate={props.attendanceScanDate}
          attendanceFeed={attendanceState.feed}
          attendanceRealtimeStatus={attendanceState.realtimeStatus}
          attendanceRefreshing={attendanceState.isValidating}
          attendanceRefreshError={attendanceState.error}
          onAttendanceRefresh={attendanceState.refreshFeed}
          readinessStatus={props.readinessStatus}
          readinessIssues={props.readinessIssues}
          payment={props.snapshot.payment}
          onAttendanceSelect={setAttendance}
          onReviewReadiness={() => setReadinessOpen(true)}
          onOpenCashFlowModal={() => setCashFlowModalOpen(true)}
        />
      </div>

      {/* Supporting Dialogs & Modals */}
      <CradleFlowDialogs
        branchName={props.branchName}
        selected={selected}
        dialog={dialog}
        setDialog={setDialog}
        updateBooking={updateBooking}
        paymentAction={props.paymentAction}
        attendance={attendance}
        setAttendance={setAttendance}
        readinessOpen={readinessOpen}
        setReadinessOpen={setReadinessOpen}
        totalsOpen={totalsOpen}
        setTotalsOpen={setTotalsOpen}
        cashFlowModalOpen={cashFlowModalOpen}
        setCashFlowModalOpen={setCashFlowModalOpen}
        readinessIssues={props.readinessIssues}
        payment={props.snapshot.payment}
        setCollected={setCollected}
        runPrimary={runPrimary}
      />
    </div>
  );
}

type DialogProps = {
  branchName: string;
  selected: CradleFlowBooking | null;
  dialog: ActiveDialog;
  setDialog: (dialog: ActiveDialog) => void;
  updateBooking: (id: string, change: Partial<CradleFlowBooking>) => void;
  paymentAction?: MutationAction;
  attendance: RecentAttendanceScan | null;
  setAttendance: (scan: RecentAttendanceScan | null) => void;
  readinessOpen: boolean;
  setReadinessOpen: (open: boolean) => void;
  totalsOpen: boolean;
  setTotalsOpen: (open: boolean) => void;
  cashFlowModalOpen: boolean;
  setCashFlowModalOpen: (open: boolean) => void;
  readinessIssues: ReadinessIssue[];
  payment: CrmTodaySnapshot["payment"];
  setCollected: React.Dispatch<React.SetStateAction<number>>;
  runPrimary: (booking: CradleFlowBooking) => void;
};

function CradleFlowDialogs(props: DialogProps) {
  return (
    <>
      <CradleFlowBookingDialog
        booking={props.selected}
        open={props.dialog === "details"}
        onOpenChange={(open) => props.setDialog(open ? "details" : null)}
        onPrimary={props.runPrimary}
      />
      <CradleFlowCompleteDialog
        booking={props.selected}
        open={props.dialog === "complete"}
        onOpenChange={(open) => props.setDialog(open ? "complete" : null)}
        onCompleted={(booking, completedAt) => {
          props.updateBooking(booking.id, {
            status: "completed",
            booking_progress_status: "completed",
            session_completed_at: completedAt,
          });
          notifyBookingsChanged();
        }}
      />
      {props.dialog === "checkout" ? (
        <CradleFlowCheckoutDialog
          booking={props.selected}
          open
          onOpenChange={(open) => props.setDialog(open ? "checkout" : null)}
          paymentAction={props.paymentAction}
          onPaid={(booking, amountPaid, method) => {
            const delta = Math.max(0, amountPaid - Number(booking.amount_paid ?? 0));
            props.updateBooking(booking.id, {
              amount_paid: amountPaid,
              payment_status: amountPaid >= Number(booking.price_paid ?? 0) ? "paid" : "pending",
              payment_method: method,
            });
            props.setCollected((value) => value + delta);
            notifyBookingsChanged();
          }}
        />
      ) : null}
      <CradleFlowReadinessDialog
        open={props.readinessOpen}
        onOpenChange={props.setReadinessOpen}
        issues={props.readinessIssues}
      />
      <CradleFlowDayTotalsDialog
        open={props.totalsOpen}
        onOpenChange={props.setTotalsOpen}
        payment={props.payment}
      />
      <CradleFlowAttendanceDialog
        scan={props.attendance}
        open={Boolean(props.attendance)}
        onOpenChange={(open) => {
          if (!open) props.setAttendance(null);
        }}
      />
      {/* Centralized Cash Flow Modal (UI Only) */}
      <CashFlowEntryDialog
        open={props.cashFlowModalOpen}
        onOpenChange={props.setCashFlowModalOpen}
        mode="create"
        branchName={props.branchName}
      />
    </>
  );
}
