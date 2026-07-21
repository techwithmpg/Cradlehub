import Link from "next/link";
import { OwnerReportsPage } from "@/components/features/owner/reports/owner-reports-page";
import {
  getOwnerReportsDataAction,
  type OwnerReportsRequest,
} from "../bookings/actions";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

interface ReportsPageProps {
  searchParams: Promise<{
    preset?: string;
    from?:   string;
    to?:     string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const initialRequest: OwnerReportsRequest = {
    preset: params.preset || "last7",
    from: params.from,
    to: params.to,
  };
  const result = await getOwnerReportsDataAction(initialRequest);

  if (!result.success) {
    return (
      <RetainedWorkspaceModule moduleId="owner-reports">
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: "0.5rem" }}>
            Unable to load reports
          </h2>
          <p style={{ color: "var(--cs-text-muted)", marginBottom: "1.5rem" }}>
            There was an issue fetching the analytics data.
          </p>
          <Link href="/owner/reports?retry=1" style={{ color: "var(--cs-sand)", fontWeight: 600, textDecoration: "underline" }}>Try again</Link>
        </div>
      </RetainedWorkspaceModule>
    );
  }

  return (
    <RetainedWorkspaceModule moduleId="owner-reports">
      <OwnerReportsPage initialData={result.data} initialRequest={initialRequest} />
    </RetainedWorkspaceModule>
  );
}
