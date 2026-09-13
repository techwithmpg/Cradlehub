import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyDriverJobsAction } from "../../../staff-portal/actions";
import { DriverRouteMapPage } from "@/components/features/staff-portal/driver/map/driver-route-map-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export const metadata: Metadata = { title: "Route Map - CradleHub Staff" };

type JobsResult = { error: string } | { items: RealDispatchItem[]; businessDate?: string };

export default async function StaffDriverMapPage() {
  const result = (await getMyDriverJobsAction()) as JobsResult;

  if ("error" in result) {
    if (result.error === "Unauthorized") redirect("/login");
    return <p role="alert" className="p-6">Route unavailable. {result.error}</p>;
  }

  return (
    <DriverRouteMapPage
      items={result.items}
      businessDate={result.businessDate}
      homeHref="/staff/driver"
      tripsHref="/staff/driver/trips"
      profileHref="/staff/driver/more"
      detailsBasePath="/staff/driver/trips"
    />
  );
}
