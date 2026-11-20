import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DriverAppDownloadDestination } from "@/components/features/driver/driver-app-download-card";
import {
  requireDriverApkActor,
  resolveDriverApkReleaseState,
} from "@/lib/driver/apk-distribution";
import { isIosUserAgent } from "@/lib/driver/platform";
import { DriverApiError } from "@/lib/driver/server";

export const metadata = {
  title: "Download Driver App | CradleHub Staff",
};

export default async function DriverPortalAppDownloadPage() {
  try {
    await requireDriverApkActor();
  } catch (error) {
    if (error instanceof DriverApiError && error.status === 401) {
      redirect("/login");
    }
    redirect("/staff-portal");
  }

  const hdrs = await headers();
  const initialIsIos = isIosUserAgent(hdrs.get("user-agent"));
  const resolved = resolveDriverApkReleaseState();

  return (
    <DriverAppDownloadDestination
      release={resolved.publicInfo}
      backHref="/driver"
      initialIsIos={initialIsIos}
    />
  );
}
