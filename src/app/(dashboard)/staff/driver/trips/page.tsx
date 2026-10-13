import { getMyDriverAllJobsAction } from "../../../staff-portal/actions";
import { DriverNativeTrips } from "@/components/features/staff-pwa/driver/driver-native-trips";

export default async function StaffDriverTripsPage() {
  const result = await getMyDriverAllJobsAction();
  if ("error" in result)
    return (
      <p role="alert" className="p-6">
        Trips unavailable. {result.error}
      </p>
    );
  return (
    <DriverNativeTrips
      businessDate={result.businessDate ?? new Date().toISOString().slice(0, 10)}
      todayItems={result.today}
      historyItems={result.recent}
    />
  );
}
