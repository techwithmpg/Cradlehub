import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDriverDispatchSnapshotAction } from "./actions";
import { isValidDriverDestination } from "@/lib/staff-pwa/driver-dispatch-policy";
import { DriverCombinedDispatchMap } from "@/components/features/staff-pwa/driver/driver-combined-dispatch-map";
import { DriverFocusedTripRoute } from "@/components/features/staff-pwa/driver/driver-focused-trip-route";

export const metadata: Metadata = { title: "Driver Trip Route — CradleHub" };

/**
 * A notification opens one verified trip, not a second, competing PWA map.
 * The explicit nativeNavigation URL is intercepted by the Android companion
 * after Start Trip succeeds; normal browser PWAs retain the existing road map.
 */
export default async function StaffDriverMapPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; nativeNavigation?: string }>;
}) {
  const { bookingId, nativeNavigation } = await searchParams;
  const result = await getDriverDispatchSnapshotAction(
    bookingId ? { bookingId } : {}
  );
  if (!result.ok) {
    if (result.message.includes("sign in")) redirect("/staff/login");
    return <p role="alert" className="p-6 text-sm">{result.message}</p>;
  }

  if (bookingId && nativeNavigation !== "1") {
    // Never display a booking from an untrusted URL unless the assigned-driver
    // query returned it among this driver's current confirmed/in-progress trips.
    const trip = result.snapshot.trips.find((job) => job.id === bookingId);
    if (!trip) {
      return <p role="alert" className="p-6 text-sm">
        This trip is no longer available to your driver account.
      </p>;
    }
    return <DriverFocusedTripRoute
      job={trip}
      verifiedDestination={isValidDriverDestination(trip)}
    />;
  }

  return <DriverCombinedDispatchMap initialSnapshot={result.snapshot} />;
}
