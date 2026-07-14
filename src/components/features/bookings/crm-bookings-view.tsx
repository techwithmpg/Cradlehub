"use client";

/**
 * CrmBookingsView
 *
 * Client shell that wraps BookingsWorkspace with SWR.
 * Uses the same cache-first pattern as other CRM data views.
 */

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { BookingsWorkspace, type BookingWorkspaceTab, type WorkspaceBookingRow } from "./bookings-workspace";
import type { DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { resolveBookingQuickFilter } from "@/lib/bookings/bookings-workspace-filters";

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type BookingsApiPayload = {
  branchId: string;
  branchName: string;
  role: string;
  date: string;
  bookings: WorkspaceBookingRow[];
  waitlistRows: WaitlistRow[];
  cashSummary: DailyCashSummaryData | null;
};

type CrmBookingsViewProps = {
  initialData: BookingsApiPayload;
  paymentAction?: ActionFn;
  confirmPaymentAction?: ActionFn;
};

async function fetcher(url: string): Promise<BookingsApiPayload> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Bookings fetch failed: ${res.status}`);
  return res.json() as Promise<BookingsApiPayload>;
}

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
}: CrmBookingsViewProps) {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? initialData.date;
  const bookingId = searchParams.get("bookingId") ?? searchParams.get("highlight") ?? undefined;
  const rawTab = searchParams.get("tab");
  const tab = parseTab(rawTab);
  const resolvedQuickFilter = resolveBookingQuickFilter(rawTab);
  const statusFilter = searchParams.get("status") ?? resolvedQuickFilter.legacyStatusFilter;
  const typeFilter = searchParams.get("type") ?? undefined;
  const deliveryFilter = searchParams.get("delivery") ?? undefined;
  const paymentFilter = searchParams.get("payment") ?? undefined;
  const assignmentFilter = searchParams.get("assignment") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");

  // Build the API URL with the current params
  const apiUrl = (() => {
    const params = new URLSearchParams({ date });
    if (bookingId) params.set("bookingId", bookingId);
    return `/api/crm/bookings?${params.toString()}`;
  })();

  const { data, mutate } = useSWR<BookingsApiPayload>(apiUrl, fetcher, {
    fallbackData: initialData,
    keepPreviousData: true,
    dedupingInterval: 30_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: false,
  });

  const payload = data ?? initialData;
  const initialTab = tab ?? tabFromStatus(statusFilter);

  return (
    <BookingsWorkspace
      workspaceContext="crm"
      viewerRole={payload.role}
      branchName={payload.branchName}
      date={payload.date}
      statusFilter={statusFilter}
      typeFilter={typeFilter}
      deliveryFilter={deliveryFilter}
      paymentFilter={paymentFilter}
      assignmentFilter={assignmentFilter}
      search={search}
      initialTab={initialTab}
      initialQuickFilter={resolvedQuickFilter.quickFilter}
      initialPage={Number.isFinite(page) && page > 0 ? Math.floor(page) : 1}
      bookings={payload.bookings}
      waitlistRows={payload.waitlistRows ?? []}
      cashSummary={payload.cashSummary}
      paymentAction={paymentAction}
      initialSelectedId={bookingId}
      confirmPaymentAction={confirmPaymentAction}
      onBookingsChanged={() => {
        void mutate();
      }}
    />
  );
}
