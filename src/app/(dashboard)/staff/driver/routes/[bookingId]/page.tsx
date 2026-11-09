import Link from "next/link";
import { getMyDriverJobByIdAction } from "@/app/(dashboard)/staff-portal/actions";
import { DriverLiveRoute } from "@/components/features/staff-pwa/driver/driver-live-route";

export default async function DriverAssignedRoutePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const result = await getMyDriverJobByIdAction(bookingId);
  if ("error" in result) {
    return (
      <main className="mx-auto max-w-md p-5" role="alert">
        <p className="text-sm font-semibold">Trip not available for this driver.</p>
        <Link href="/staff/driver/trips" className="mt-4 inline-block underline">
          Back to assigned trips
        </Link>
      </main>
    );
  }
  return <DriverLiveRoute job={result.job} />;
}
