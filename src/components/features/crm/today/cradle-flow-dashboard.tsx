"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  crmStartServiceAction,
  markBookingArrivedAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import {
  BOOKINGS_CHANGED_EVENT,
  notifyBookingsChanged,
} from "@/lib/bookings/bookings-client-events";
import {
  getCradleFlowCounts,
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
import { CradleFlowMoneySummary, CradleFlowRecentActivity } from "./cradle-flow-lower-panels";
import { CradleFlowSideRail } from "./cradle-flow-side-rail";
import { CradleFlowSummary } from "./cradle-flow-summary";
import {
  CradleFlowAttendanceDialog,
  CradleFlowDayTotalsDialog,
  CradleFlowReadinessDialog,
} from "./cradle-flow-support-dialogs";
import { CradleFlowWorkflow } from "./cradle-flow-workflow";

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
  const router = useRouter();
  const [bookings, setBookings] = useState(props.queueData);
  const [selected, setSelected] = useState<CradleFlowBooking | null>(null);
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [attendance, setAttendance] = useState<RecentAttendanceScan | null>(null);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [collected, setCollected] = useState(props.snapshot.payment?.total_collected ?? 0);
  const [isActing, startAction] = useTransition();

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(BOOKINGS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BOOKINGS_CHANGED_EVENT, refresh);
  }, [router]);

  const counts = useMemo(() => getCradleFlowCounts(bookings), [bookings]);
  const pendingBooking =
    bookings.find((booking) => ["pending", "pending_crm_confirmation"].includes(booking.status)) ??
    null;
  const warnings = props.readinessIssues.filter((issue) => issue.severity !== "info").length;

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
    <div className="mx-auto grid w-full max-w-[1600px] gap-4 p-3 sm:p-5 lg:p-6">
      <CradleFlowHeader
        branchName={props.branchName}
        fallbackDateLabel={props.dateLabel}
        warningCount={warnings}
        onRefresh={() => router.refresh()}
        onReviewWarnings={() => setReadinessOpen(true)}
      />
      <CradleFlowActions pendingBooking={pendingBooking} onResumePending={openBooking} />
      <CradleFlowSummary counts={counts} collectedRevenue={collected} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className={isActing ? "min-w-0 opacity-80" : "min-w-0"}>
          <CradleFlowWorkflow
            bookings={bookings}
            staffAvailable={props.snapshot.staffReadiness.availableNow}
            pendingFollowUps={props.actionNotifications.length}
            onOpen={openBooking}
            onPrimary={runPrimary}
          />
        </main>
        <CradleFlowSideRail
          branchName={props.branchName}
          attendanceDate={props.attendanceScanDate}
          attendanceFeed={props.attendanceScanFeed}
          readinessStatus={props.readinessStatus}
          readinessIssues={props.readinessIssues}
          onAttendanceSelect={setAttendance}
          onReviewReadiness={() => setReadinessOpen(true)}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.55fr)]">
        <CradleFlowRecentActivity
          attendance={props.attendanceScanFeed}
          notifications={props.actionNotifications}
        />
        <CradleFlowMoneySummary
          payment={props.snapshot.payment}
          collectedOverride={collected}
          onViewTotals={() => setTotalsOpen(true)}
        />
      </div>
      <CradleFlowDialogs
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
        readinessIssues={props.readinessIssues}
        payment={props.snapshot.payment}
        setCollected={setCollected}
        runPrimary={runPrimary}
      />
    </div>
  );
}

type DialogProps = {
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
    </>
  );
}
