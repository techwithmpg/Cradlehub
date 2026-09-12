import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyDriverJobsAction } from "../../../staff-portal/actions";
import { DriverRouteMapPage } from "@/components/features/staff-portal/driver/map/driver-route-map-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export const metadata: Metadata = { title: "Route Map - CradleHub Staff" };

type JobsResult = { error: string } | { items: RealDispatchItem[] };

export default async function StaffDriverMapPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const result = (await getMyDriverJobsAction(today)) as JobsResult;

  if ("error" in result) redirect("/login");

  return (
    <DriverRouteMapPage
      items={result.items}
      homeHref="/staff/driver"
      tripsHref="/staff/driver/trips"
      profileHref="/staff/driver/more"
      detailsBasePath="/staff/driver/trips"
    />
  );
}
