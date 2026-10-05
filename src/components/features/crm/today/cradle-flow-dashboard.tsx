"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  crmStartServiceAction,
  markBookingArrivedAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { useAttendanceScanFeed } from "@/components/features/attendance/use-attendance-scan-feed";
import { RoomAssignmentModal } from "@/components/features/bookings/room-assignment-modal";
import {
  BOOKINGS_CHANGED_EVENT,
  notifyBookingsChanged,
} from "@/lib/bookings/bookings-client-events";
import type { FinancialEntryMode } from "@/components/features/cash-flow/record-financial-entry-modal";
import { getCradleFlowStage, type CradleFlowBooking } from "@/lib/crm/cradle-flow";
import type { AttendanceScanFeedData, RecentAttendanceScan } from "@/lib/attendance/types";
import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import { CradleFlowActions } from "./cradle-flow-actions";
import { CradleFlowBookingDialog } from "./cradle-flow-booking-dialog";
import { CradleFlowCheckoutDialog } from "./cradle-flow-checkout-dialog";
import { CradleFlowCompleteDialog } from "./cradle-flow-complete-dialog";
import { CradleFlowHeader } from "./cradle-flow-header";
import { FrontDeskDutyBanner } from "./front-desk-duty-banner";
import type { FrontDeskDutyContext } from "@/lib/queries/front-desk-duty";
import {
  CradleFlowFinancialEntry,
  type CradleFlowFinancialEntryRequest,
} from "./cradle-flow-financial-entry";
import { CradleFlowTherapistDialog } from "./cradle-flow-therapist-dialog";
import { getCradleFlowDisplayCounts, type CradleFlowFilter } from "./cradle-flow-display";
import { CradleFlowSideRail } from "./cradle-flow-side-rail";
import {
  CradleFlowAttendanceDialog,
  CradleFlowDayTotalsDialog,
  CradleFlowReadinessDialog,
} from "./cradle-flow-support-dialogs";
import { CradleFlowWorkflow } from "./cradle-flow-workflow";

type MutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;
type ActiveDialog = "details" | "complete" | "checkout" | null;

type CradleFlowDashboardProps = {
  duty: FrontDeskDutyContext | null;
  handoverConfirmed: boolean;
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
  const bookings = props.queueData;
  const [selected, setSelected] = useState<CradleFlowBooking | null>(null);
  const selectedBooking = bookings.find((booking) => booking.id === selected?.id) ?? selected;
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [assignment, setAssignment] = useState<"room" | "therapist" | null>(null);
  const [attendance, setAttendance] = useState<RecentAttendanceScan | null>(null);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [totalsOpen, setTotalsOpen] = useState(false);
  const collected = props.snapshot.payment?.total_collected ?? 0;
  const [filter, setFilter] = useState<CradleFlowFilter>("all");
  const [financialRequest, setFinancialRequest] = useState<CradleFlowFinancialEntryRequest | null>(
    null
  );
  const [isActing, startAction] = useTransition();
  const attendanceState = useAttendanceScanFeed({
    workspace: "crm",
    selectedDate: props.attendanceScanDate,
    branchId: props.attendanceScanFeed.branchId,
    initialFeed: props.attendanceScanFeed,
    maxItems: 6,
  });

  const counts = useMemo(() => getCradleFlowDisplayCounts(bookings), [bookings]);
  const pendingBooking =
    bookings.find((booking) => ["pending", "pending_crm_confirmation"].includes(booking.status)) ??
    null;
  const warnings = props.readinessIssues.filter((issue) => issue.severity !== "info").length;

  useEffect(() => {
    const refreshBookings = () => router.refresh();
    window.addEventListener(BOOKINGS_CHANGED_EVENT, refreshBookings);
    return () => window.removeEventListener(BOOKINGS_CHANGED_EVENT, refreshBookings);
  }, [router]);

  const openFinancialEntry = useCallback((mode: FinancialEntryMode) => {
    setFinancialRequest({ mode });
  }, []);

  function openBooking(booking: CradleFlowBooking) {
    setSelected(booking);
    setDialog("details");
  }

  function openRoomAssignment(booking: CradleFlowBooking) {
    setSelected(booking);
    setAssignment("room");
  }

  function openTherapistAssignment(booking: CradleFlowBooking) {
    setSelected(booking);
    setAssignment("therapist");
  }

  function runPrimary(booking: CradleFlowBooking) {
    const stage = getCradleFlowStage(booking);
    setSelected(booking);
    if (stage === "in_service") return setDialog("complete");
    if (stage === "ready_to_pay") {
      setFinancialRequest({
        mode: "customer_payment",
        orderId: booking.order_id ?? booking.id,
        allowLegacyCheckout: !booking.order_id,
      });
      return;
    }
    if (stage === "completed") {
      router.push(`/crm/bookings?bookingId=${booking.id}`);
      return;
    }
    if (
      booking.status === "confirmed" &&
      (booking.type === "home_service" || booking.delivery_type === "home_service")
    ) {
      router.push("/crm/dispatch");
      return;
    }
    startAction(async () => {
      let result: { success: boolean; error?: string };
      if (["pending", "pending_payment", "pending_crm_confirmation"].includes(booking.status)) {
        result = props.statusAction
          ? await props.statusAction({ bookingId: booking.id, status: "confirmed" })
          : { success: false, error: "Confirmation action is unavailable." };
      } else if (booking.booking_progress_status === "checked_in") {
        result = await crmStartServiceAction({ bookingId: booking.id });
      } else {
        result = await markBookingArrivedAction({ bookingId: booking.id });
        if (result.success) {
          if (!booking.resource_id) openRoomAssignment(booking);
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
    <div className="mx-auto grid w-full min-w-0 max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-5 lg:p-6">
      <CradleFlowHeader
        branchName={props.branchName}
        fallbackDateLabel={props.dateLabel}
        warningCount={warnings}
        onRefresh={() => router.refresh()}
        onReviewWarnings={() => setReadinessOpen(true)}
      />
      <FrontDeskDutyBanner
        duty={props.duty}
        handoverConfirmed={props.handoverConfirmed}
        branchName={props.branchName}
      />
      <CradleFlowActions
        pendingBooking={pendingBooking}
        onResumePending={openBooking}
        onOpenFinancialEntry={openFinancialEntry}
      />
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start">
        <main
          className={isActing ? "w-full min-w-0 opacity-80 xl:flex-1" : "w-full min-w-0 xl:flex-1"}
        >
          <CradleFlowWorkflow
            bookings={bookings}
            staffAvailable={props.snapshot.staffReadiness.availableNow}
            pendingFollowUps={props.actionNotifications.length}
            onOpen={openBooking}
            onPrimary={runPrimary}
            onAssignRoom={openRoomAssignment}
            onAssignTherapist={openTherapistAssignment}
            filter={filter}
            onFilterChange={setFilter}
          />
        </main>
        <div className="w-full min-w-0 shrink-0 xl:w-76 2xl:w-80">
          <CradleFlowSideRail
            branchName={props.branchName}
            attendanceDate={props.attendanceScanDate}
            attendanceFeed={attendanceState.feed}
            attendanceRealtimeStatus={attendanceState.realtimeStatus}
            attendanceRefreshing={attendanceState.isValidating}
            attendanceRefreshError={attendanceState.error}
            onAttendanceRefresh={attendanceState.refreshFeed}
            bookings={bookings}
            payment={props.snapshot.payment}
            collected={collected}
            readyToPayCount={counts.ready_to_pay}
            readinessIssues={props.readinessIssues}
            onAttendanceSelect={setAttendance}
            onReviewReadiness={() => setReadinessOpen(true)}
            onOpenBooking={openBooking}
            onShowNeedsAction={() => setFilter("needs_action")}
            onShowReadyToPay={() => setFilter("ready_to_pay")}
            onViewTotals={() => setTotalsOpen(true)}
          />
        </div>
      </div>
      <CradleFlowDialogs
        selected={selectedBooking}
        dialog={dialog}
        setDialog={setDialog}
        paymentAction={props.paymentAction}
        attendance={attendance}
        setAttendance={setAttendance}
        readinessOpen={readinessOpen}
        setReadinessOpen={setReadinessOpen}
        totalsOpen={totalsOpen}
        setTotalsOpen={setTotalsOpen}
        readinessIssues={props.readinessIssues}
        payment={props.snapshot.payment}
        runPrimary={runPrimary}
        assignment={assignment}
        setAssignment={setAssignment}
        onAssignRoom={openRoomAssignment}
        onAssignTherapist={openTherapistAssignment}
      />
      {financialRequest ? (
        <CradleFlowFinancialEntry
          request={financialRequest}
          onClose={() => setFinancialRequest(null)}
          onLegacyCheckout={() => {
            setFinancialRequest(null);
            setDialog("checkout");
          }}
          onSuccess={() => {
            if (financialRequest.mode === "customer_payment") notifyBookingsChanged();
            else router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

type DialogProps = {
  selected: CradleFlowBooking | null;
  dialog: ActiveDialog;
  setDialog: (dialog: ActiveDialog) => void;
  paymentAction?: MutationAction;
  attendance: RecentAttendanceScan | null;
  setAttendance: (scan: RecentAttendanceScan | null) => void;
  readinessOpen: boolean;
  setReadinessOpen: (open: boolean) => void;
  totalsOpen: boolean;
  setTotalsOpen: (open: boolean) => void;
  readinessIssues: ReadinessIssue[];
  payment: CrmTodaySnapshot["payment"];
  runPrimary: (booking: CradleFlowBooking) => void;
  assignment: "room" | "therapist" | null;
  setAssignment: (assignment: "room" | "therapist" | null) => void;
  onAssignRoom: (booking: CradleFlowBooking) => void;
  onAssignTherapist: (booking: CradleFlowBooking) => void;
};

function CradleFlowDialogs(props: DialogProps) {
  return (
    <>
      <CradleFlowBookingDialog
        booking={props.selected}
        open={props.dialog === "details"}
        onOpenChange={(open) => props.setDialog(open ? "details" : null)}
        onPrimary={props.runPrimary}
        onAssignRoom={props.onAssignRoom}
        onAssignTherapist={props.onAssignTherapist}
      />
      {props.assignment === "room" && props.selected ? (
        <RoomAssignmentModal
          key={props.selected.id}
          open
          booking={{ id: props.selected.id, resource_id: props.selected.resource_id ?? null }}
          onOpenChange={(open) => {
            if (!open) props.setAssignment(null);
          }}
          onAssigned={notifyBookingsChanged}
        />
      ) : null}
      {props.assignment === "therapist" && props.selected ? (
        <CradleFlowTherapistDialog
          key={props.selected.id}
          booking={props.selected}
          open
          onOpenChange={(open) => {
            if (!open) props.setAssignment(null);
          }}
          onAssigned={notifyBookingsChanged}
        />
      ) : null}
      <CradleFlowCompleteDialog
        booking={props.selected}
        open={props.dialog === "complete"}
        onOpenChange={(open) => props.setDialog(open ? "complete" : null)}
        onCompleted={() => {
          notifyBookingsChanged();
        }}
      />
      {props.dialog === "checkout" ? (
        <CradleFlowCheckoutDialog
          booking={props.selected}
          open
          onOpenChange={(open) => props.setDialog(open ? "checkout" : null)}
          paymentAction={props.paymentAction}
          onPaid={() => {
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
