import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyDriverJobByIdAction } from "@/app/(dashboard)/staff-portal/actions";

/** Preserve old push deep links without creating a second map workspace. */
export default async function LegacyDriverTripRoutePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const result = await getMyDriverJobByIdAction(bookingId);
  if ("error" in result) return (
    <main role="alert" className="mx-auto max-w-md p-5">
      <p className="text-sm font-semibold">This route is not assigned to your account.</p>
      <Link href="/staff/driver/map" className="mt-3 inline-block underline">Open driver map</Link>
    </main>
  );
  redirect(`/staff/driver/map?bookingId=${encodeURIComponent(result.job.id)}`);
}
