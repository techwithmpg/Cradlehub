import { getMyDriverAllJobsAction } from "../../../staff-portal/actions";
import { DriverTripsPage } from "@/components/features/staff-portal/driver/trips/driver-trips-page";

export default async function StaffDriverTripsPage() {
  const result = await getMyDriverAllJobsAction();
  if ("error" in result) return <p role="alert" className="p-6">Trips unavailable. {result.error}</p>;
  return <DriverTripsPage businessDate={result.businessDate} todayItems={result.today} historyItems={result.recent} detailsBasePath="/staff/driver/trips" />;
}
