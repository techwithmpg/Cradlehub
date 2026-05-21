import { PageHeader } from "@/components/features/dashboard/page-header";
import { StaffSchedulePageClient } from "@/components/features/staff-schedule/staff-schedule-page-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";

async function getPageData(branchId: string): Promise<{
  items: StaffScheduleItem[];
  error: string | null;
}> {
  try {
    const items = await getStaffWithAvailability(branchId);
    return { items: items as unknown as StaffScheduleItem[], error: null };
  } catch (err) {
    console.error("[crm/staff-availability] load failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { items: [], error: "Failed to load schedule setup data. Please refresh." };
  }
}

// ── Explainer card ──────────────────────────────────────────────────────────

type ExplainerCardProps = {
  icon: string;
  title: string;
  children: React.ReactNode;
};

function ExplainerCard({ icon, title, children }: ExplainerCardProps) {
  return (
    <div
      style={{
        background: "var(--cs-surface-raised)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding: "14px 16px",
        display: "flex",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36, height: 36, flexShrink: 0,
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-sm)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--cs-text-muted)", lineHeight: 1.55 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Shift type badge ────────────────────────────────────────────────────────

function ShiftPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-block", padding: "2px 9px",
        borderRadius: 10, fontSize: 11, fontWeight: 500,
        background: bg, color,
      }}
    >
      {label}
    </span>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function CrmStaffAvailabilityPage() {
  const branchId = await getManagerBranchId();
  const { items, error } = await getPageData(branchId);

  const noScheduleCount = items.filter((i) => !i.schedules.some((s) => s.is_active)).length;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Schedule Setup"
        description="Set planned weekly shifts, opening/closing assignments, day-off overrides, and blocked time for staff."
      />

      {/* Explainer cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <ExplainerCard icon="📋" title="What this page controls">
          Planned weekly shifts, opening/closing assignments, day-offs, overrides, and blocked
          time. These rules drive when staff appear as bookable in the scheduling engine.
        </ExplainerCard>

        <ExplainerCard icon="🗓" title="Shift types used for booking">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <ShiftPill label="Opening" color="#4A7C59" bg="rgba(74,124,89,0.12)" />
              <ShiftPill label="Closing" color="#2563EB" bg="rgba(59,130,246,0.12)" />
              <ShiftPill label="Regular" color="var(--cs-text-muted)" bg="rgba(107,114,128,0.1)" />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <ShiftPill label="Day off"  color="var(--cs-text-muted)" bg="rgba(107,114,128,0.1)" />
              <ShiftPill label="Override" color="#D97706" bg="rgba(217,119,6,0.1)" />
              <ShiftPill label="Blocked"  color="#DC2626" bg="rgba(220,38,38,0.1)" />
            </div>
          </div>
        </ExplainerCard>

        {noScheduleCount > 0 ? (
          <ExplainerCard icon="⚠️" title="Needs setup">
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              <li>{noScheduleCount} staff member{noScheduleCount !== 1 ? "s" : ""} with no weekly pattern</li>
              <li>Staff without a schedule will not appear in the booking engine</li>
              <li>Click a staff row below to set their schedule</li>
            </ul>
          </ExplainerCard>
        ) : (
          <ExplainerCard icon="✅" title="All staff scheduled">
            Every active staff member has a weekly schedule set. These schedules control
            when they appear as bookable in the public booking flow and internal dispatch.
          </ExplainerCard>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load staff data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <StaffSchedulePageClient items={items} />
      )}
    </section>
  );
}
