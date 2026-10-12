import { getMyDriverJobByIdAction } from "../../../../staff-portal/actions";
import { DriverNativeDetail } from "@/components/features/staff-pwa/driver/driver-native-detail";

export default async function StaffDriverTripPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const result = await getMyDriverJobByIdAction(bookingId);
  if ("error" in result)
    return (
      <p role="alert" className="p-6">
        {result.error}
      </p>
    );
  return (
    <DriverNativeDetail
      key={`${result.job.id}:${result.job.bookingProgressStatus}`}
      job={result.job}
    />
  );
}
