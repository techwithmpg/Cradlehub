import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDriverDispatchSnapshotAction } from "./actions";
import { DriverCombinedDispatchMap } from "@/components/features/staff-pwa/driver/driver-combined-dispatch-map";

export const metadata: Metadata = { title: "Live Dispatch Route — CradleHub Driver" };

/** Canonical installed-PWA destination for every assigned Home Service alert. */
export default async function StaffDriverMapPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const { bookingId } = await searchParams;
  const result = await getDriverDispatchSnapshotAction(
    bookingId ? { bookingId } : {}
  );
  if (!result.ok) {
    if (result.message.includes("sign in")) redirect("/staff/login");
    return <p role="alert" className="p-6 text-sm">{result.message}</p>;
  }
  return <DriverCombinedDispatchMap initialSnapshot={result.snapshot} />;
}
