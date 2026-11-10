import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyDriverJobByIdAction } from "@/app/(dashboard)/staff-portal/actions";
import { getDriverPrimaryTrip } from "@/lib/staff-pwa/driver-ui-model";
import { getDriverDispatchSnapshotAction } from "./actions";
import { DriverFocusedTripRoute } from "@/components/features/staff-pwa/driver/driver-focused-trip-route";
import { DriverCombinedDispatchMap } from "@/components/features/staff-pwa/driver/driver-combined-dispatch-map";

export const metadata: Metadata = { title: "My Route — CradleHub Driver" };

/**
 * Notifications always open their specifically assigned booking, not the
 * multi-stop combined route. Preserve the previous read-only combined map
 * behind an explicit fallback view while the focused UI is evaluated.
 */
export default async function StaffDriverMapPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; view?: string }>;
}) {
  const { bookingId, view } = await searchParams;
  if (view === "combined") {
    const response = await getDriverDispatchSnapshotAction(bookingId ? { bookingId } : {});
    if (!response.ok) {
      if (response.message.includes("sign in")) redirect("/staff/login");
      return <p role="alert" className="p-6 text-sm">{response.message}</p>;
    }
    return <DriverCombinedDispatchMap initialSnapshot={response.snapshot} />;
  }

  if (bookingId) {
    const assigned = await getMyDriverJobByIdAction(bookingId);
    if ("error" in assigned) {
      if (assigned.error === "Unauthorized") redirect("/staff/login");
      return <p role="alert" className="p-6 text-sm">This trip is not available to your driver account.</p>;
    }
    return <DriverFocusedTripRoute key={assigned.job.id} job={assigned.job} />;
  }

  const response = await getDriverDispatchSnapshotAction();
  if (!response.ok) {
    if (response.message.includes("sign in")) redirect("/staff/login");
    return <p role="alert" className="p-6 text-sm">{response.message}</p>;
  }
  const primary = getDriverPrimaryTrip(response.snapshot.trips);
  if (primary) return <DriverFocusedTripRoute key={primary.id} job={primary} />;

  return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-2xl font-bold text-[#163a2b]">No trip to navigate</h1>
      <p className="mt-2 text-sm text-[#617068]">Your next assigned route will appear here.</p>
      <Link href="/staff/driver/trips"
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#163a2b] px-6 text-sm font-bold text-white">
        View trips
      </Link>
    </main>
  );
}
