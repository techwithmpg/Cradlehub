import { PageHeader } from "@/components/features/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CrmAvailabilitySummary } from "@/components/features/crm/availability/crm-availability-summary";
import { CrmAvailabilityClient } from "@/components/features/crm/availability/crm-availability-client";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getCrmAvailabilitySnapshot, type CrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function getPageData(branchId: string): Promise<{
  snapshot: CrmAvailabilitySnapshot | null;
  error: string | null;
}> {
  try {
    const snapshot = await getCrmAvailabilitySnapshot({
      branchId,
      date: todayDateString(),
    });
    return { snapshot, error: null };
  } catch (err) {
    console.error("[crm/availability] load failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { snapshot: null, error: "Failed to load availability data. Please refresh." };
  }
}

export default async function CrmAvailabilityPage() {
  const branchId = await getManagerBranchId();
  const { snapshot, error } = await getPageData(branchId);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Live Availability"
        description="See who is scheduled, free, busy, off today, or needs setup before assigning bookings or dispatch."
      />

      {/* Schedule-based disclaimer */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 14px",
          background: "var(--cs-surface-raised)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-sm)",
          fontSize: 12, color: "var(--cs-text-muted)",
        }}
      >
        <span style={{ fontSize: 14 }}>ℹ</span>
        This view is <strong style={{ color: "var(--cs-text)" }}>schedule-based</strong> until staff check-in tracking is added.
      </div>

      {error || !snapshot ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load availability</AlertTitle>
          <AlertDescription>{error ?? "Unknown error."}</AlertDescription>
        </Alert>
      ) : (
        <>
          <CrmAvailabilitySummary summary={snapshot.summary} />
          <CrmAvailabilityClient snapshot={snapshot} />
        </>
      )}
    </section>
  );
}
