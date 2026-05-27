"use client";

/**
 * CrmBookingsView
 *
 * Client shell that wraps BookingsWorkspace with SWR.
 * Same pattern as CrmScheduleView — instant from cache, silent background revalidation.
 */

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { BookingsWorkspace, type WorkspaceBookingRow } from "./bookings-workspace";
import type { DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type BookingsApiPayload = {
  branchId: string;
  branchName: string;
  role: string;
  date: string;
  bookings: WorkspaceBookingRow[];
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

export function CrmBookingsView({
  initialData,
  paymentAction,
  confirmPaymentAction,
}: CrmBookingsViewProps) {
  const searchParams = useSearchParams();
  const today = new Date().toISOString().split("T")[0]!;
  const date = searchParams.get("date") ?? today;
  const bookingId = searchParams.get("bookingId") ?? undefined;
  const statusFilter = searchParams.get("status") ?? undefined;
  const typeFilter = searchParams.get("type") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  // Build the API URL with the current params
  const apiUrl = (() => {
    const params = new URLSearchParams({ date });
    if (bookingId) params.set("bookingId", bookingId);
    return `/api/crm/bookings?${params.toString()}`;
  })();

  const { data } = useSWR<BookingsApiPayload>(apiUrl, fetcher, {
    fallbackData: initialData,
    keepPreviousData: true,
    dedupingInterval: 30_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: false,
  });

  const payload = data ?? initialData;

  // Client-side filter (status/type/search) — these are URL state only, not API params
  let bookings = payload.bookings;
  if (statusFilter) bookings = bookings.filter((b) => b.status === statusFilter);
  if (typeFilter) bookings = bookings.filter((b) => b.type === typeFilter);

  return (
    <BookingsWorkspace
      workspaceContext="crm"
      viewerRole={payload.role}
      branchName={payload.branchName}
      date={payload.date}
      statusFilter={statusFilter}
      typeFilter={typeFilter}
      search={search}
      bookings={bookings}
      cashSummary={payload.cashSummary}
      paymentAction={paymentAction}
      initialSelectedId={bookingId}
      confirmPaymentAction={confirmPaymentAction}
    />
  );
}
