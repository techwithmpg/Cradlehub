"use client";

/**
 * CrmBookingsView
 *
 * Client shell that wraps BookingsWorkspace with generation-aware SWR.
 * Follows the retained workspace operational contract established in PERF-1A/PERF-2.
 */

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookingsWorkspace,
  type BookingWorkspaceTab,
} from "./bookings-workspace";
import { resolveBookingQuickFilter } from "@/lib/bookings/bookings-workspace-filters";
import { resolveBookingReferenceSource } from "@/lib/bookings/booking-source";
import { useSheetNativeReferences } from "@/components/features/crm/master-sheet/use-sheet-native-references";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { refreshCrmBookingsOperationalDataAction } from "@/app/(dashboard)/crm/bookings/actions";
import type { CrmBookingsOperationalData } from "@/lib/queries/crm-bookings-operational";

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type BookingsApiPayload = CrmBookingsOperationalData;

type CrmBookingsViewProps = {
  initialData: BookingsApiPayload;
  paymentAction?: ActionFn;
  confirmPaymentAction?: ActionFn;
  refreshAction?: (params?: {
    date?: string;
    upcoming?: boolean;
    bookingId?: string;
  }) => Promise<CrmBookingsOperationalData>;
};

function parseTab(raw: string | null): BookingWorkspaceTab | undefined {
  switch (raw) {
    case "needs-action":
    case "upcoming":
    case "active":
    case "completed":
      return raw;
    default:
      return undefined;
  }
}

function tabFromStatus(status: string | undefined): BookingWorkspaceTab | undefined {
  switch (status) {
    case "pending":
    case "pending_payment":
    case "pending_crm_confirmation":
      return "needs-action";
    case "confirmed":
      return "upcoming";
    case "in_progress":
      return "active";
    case "completed":
      return "completed";
    default:
      return undefined;
  }
}

export function CrmBookingsView({
  initialData,
  paymentAction,
  confirmPaymentAction,
  refreshAction = refreshCrmBookingsOperationalDataAction,
}: CrmBookingsViewProps) {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? initialData.date;
  const bookingId = searchParams.get("bookingId") ?? searchParams.get("highlight") ?? undefined;
  const rawTab = searchParams.get("tab");
  const tab = parseTab(rawTab);
  const resolvedQuickFilter = resolveBookingQuickFilter(rawTab);
  const isUpcoming = resolvedQuickFilter.quickFilter === "upcoming";
  const statusFilter = searchParams.get("status") ?? resolvedQuickFilter.legacyStatusFilter;
  const typeFilter = searchParams.get("type") ?? undefined;
  const deliveryFilter = searchParams.get("delivery") ?? undefined;
  const paymentFilter = searchParams.get("payment") ?? undefined;
  const assignmentFilter = searchParams.get("assignment") ?? undefined;
  const referenceSource = resolveBookingReferenceSource(searchParams.get("referenceSource"));
  const search = searchParams.get("search") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");

  // Server dataset request identity
  const requestKey = `${date}:${isUpcoming ? "upcoming" : "daily"}:${bookingId ?? ""}`;

  const fetcher = useCallback(() => {
    return refreshAction({
      date,
      upcoming: isUpcoming,
      bookingId,
    });
  }, [refreshAction, date, isUpcoming, bookingId]);

  const { data, error, generation, revalidate } =
    useGenerationAwareWorkspaceSWR<CrmBookingsOperationalData>(
      "crm-bookings",
      requestKey,
      fetcher,
      initialData
    );

  const payload = data ?? initialData;

  const {
    state: sheetState,
    isLoading: sheetLoading,
    isRefreshing: sheetRefreshing,
    refresh: refreshSheet,
  } = useSheetNativeReferences(payload.date, referenceSource === "master_sheet", true);

  const initialTab = tab ?? tabFromStatus(statusFilter);

  return (
    <>
      {payload.selectedOutsideWindow ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          The selected booking is beyond the 14-day Upcoming window and is shown here for this link.
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>Bookings could not refresh. Showing the last loaded data.</span>
          <button
            type="button"
            onClick={() => void revalidate().catch(() => undefined)}
            className="ml-3 font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : null}
      <BookingsWorkspace
        key={`${referenceSource}:${isUpcoming ? "upcoming" : "daily"}:${bookingId ?? ""}`}
        workspaceContext="crm"
        viewerRole={payload.role}
        branchName={payload.branchName}
        date={payload.date}
        businessDate={payload.businessDate}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        referenceSource={referenceSource}
        deliveryFilter={deliveryFilter}
        paymentFilter={paymentFilter}
        assignmentFilter={assignmentFilter}
        search={search}
        initialTab={initialTab}
        initialQuickFilter={resolvedQuickFilter.quickFilter}
        initialPage={Number.isFinite(page) && page > 0 ? Math.floor(page) : 1}
        bookings={payload.bookings}
        sheetState={sheetState}
        sheetLoading={sheetLoading}
        sheetRefreshing={sheetRefreshing}
        onSheetRefresh={() => void refreshSheet()}
        waitlistRows={payload.waitlistRows ?? []}
        cashSummary={payload.cashSummary}
        paymentAction={paymentAction}
        initialSelectedId={bookingId}
        confirmPaymentAction={confirmPaymentAction}
        isRefreshing={generation.isRefreshing}
        onBookingsChanged={() => {
          void revalidate().catch(() => undefined);
        }}
      />
    </>
  );
}
