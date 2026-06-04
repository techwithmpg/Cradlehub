import { DriverTripsPage } from "./trips/driver-trips-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverDispatchPageProps = {
  upcoming: RealDispatchItem[];
  history: RealDispatchItem[];
};

export function DriverDispatchPage({ upcoming, history }: DriverDispatchPageProps) {
  return <DriverTripsPage todayItems={upcoming} historyItems={history} />;
}
