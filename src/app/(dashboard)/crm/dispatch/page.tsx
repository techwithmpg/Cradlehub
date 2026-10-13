export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { logInfo } from "@/lib/logger";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

export const metadata: Metadata = { title: "Home Service Operations — CRM" };

export default async function CrmDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bookingId?: string }>;
}) {
  const { role, branchId, branchName } = await getFrontDeskContext();
  const today = getBranchBusinessDate();
  const params = await searchParams;
  let upcoming = params.tab === "upcoming";
  let selectedBookingId: string | undefined;
  if (params.bookingId) {
    const { createClient } = await import("@/lib/supabase/server");
    const client = await createClient();
    const { data: booking, error } = await client
      .from("bookings")
      .select("id, booking_date, delivery_type")
      .eq("id", params.bookingId)
      .eq("branch_id", branchId)
      .eq("delivery_type", "home_service")
      .maybeSingle();
    if (error || !booking) throw new Error("Home Service booking is unavailable for this branch.");
    upcoming = booking.booking_date > today;
    selectedBookingId = booking.id;
  }
  const data = await getDispatchData({ branchId, date: today, upcoming, throwOnError: upcoming });
  if (selectedBookingId && !data.items.some((item) => item.id === selectedBookingId)) {
    const exact = await getDispatchData({
      branchId,
      date: today,
      bookingId: selectedBookingId,
      throwOnError: true,
    });
    data.items.push(...exact.items);
  }

  logInfo("dispatch.queue.loaded", {
    role,
    branchId,
    date: today,
    count: data.items.length,
  });

  return (
    <CrmOperationalPageShell
      title="Home Service Operations"
      description="Monitor home-service bookings, assignments, customer locations, and travel progress."
      context={`${branchName} · ${today} · ${role} view`}
    >
      <HomeServiceDispatchWorkspace
        key={upcoming ? "upcoming" : "today"}
        role="crm"
        data={data}
        showHeader={false}
        upcoming={upcoming}
        selectedBookingId={selectedBookingId}
      />
    </CrmOperationalPageShell>
  );
}
