import { redirect } from "next/navigation";
import { DriverAppDownloadDestination } from "@/components/features/driver/driver-app-download-card";
import {
  requireDriverApkActor,
  resolveDriverApkReleaseState,
} from "@/lib/driver/apk-distribution";
import { DriverApiError } from "@/lib/driver/server";

export const metadata = {
  title: "Download Driver App | CradleHub Driver",
};

export default async function StaffDriverAppDownloadPage() {
  try {
    await requireDriverApkActor();
  } catch (error) {
    if (error instanceof DriverApiError && error.status === 401) {
      redirect("/staff/login");
    }
    redirect("/staff/");
  }

  const resolved = resolveDriverApkReleaseState();
  return (
    <DriverAppDownloadDestination
      release={resolved.publicInfo}
      backHref="/staff/driver/more"
    />
  );
}
