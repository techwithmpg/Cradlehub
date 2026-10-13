import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyDriverJobsAction } from "../../../staff-portal/actions";
import { DriverNativeMap } from "@/components/features/staff-pwa/driver/driver-native-map";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export const metadata: Metadata = { title: "Route Map - CradleHub Staff" };

type JobsResult = { error: string } | { items: RealDispatchItem[]; businessDate?: string };

export default async function StaffDriverMapPage() {
  const result = (await getMyDriverJobsAction()) as JobsResult;

  if ("error" in result) {
    if (result.error === "Unauthorized") redirect("/staff/login");
    return (
      <p role="alert" className="p-6">
        Route unavailable. {result.error}
      </p>
    );
  }

  return (
    <DriverNativeMap
      items={result.items}
      businessDate={result.businessDate ?? new Date().toISOString().slice(0, 10)}
    />
  );
}
