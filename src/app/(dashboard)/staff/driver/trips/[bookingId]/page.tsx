import { getMyDriverJobByIdAction } from "../../../../staff-portal/actions";
import { DriverJobDetailsPage } from "@/components/features/staff-portal/driver/driver-job-details-page";

export default async function StaffDriverTripPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const result = await getMyDriverJobByIdAction(bookingId);
  if ("error" in result) return <p role="alert" className="p-6">{result.error}</p>;
  return <DriverJobDetailsPage job={result.job} backHref="/staff/driver/trips" />;
}
