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
  const today = new Date().toISOString().split("T")[0]!;
  const date = searchParams.get("date") ?? today;
  const bookingId = searchParams.get("bookingId") ?? searchParams.get("highlight") ?? undefined;
  const tab = parseTab(searchParams.get("tab"));
  const statusFilter = searchParams.get("status") ?? undefined;
  const typeFilter = searchParams.get("type") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  // Build the API URL with the current params
  const apiUrl = (() => {
    const params = new URLSearchParams({ date });
    if (bookingId) params.set("bookingId", bookingId);
    if (tab) params.set("tab", tab);
    if (statusFilter && !tab) params.set("status", statusFilter);
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
      search={search}
      initialTab={initialTab}
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
