import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { ControlKpiStrip } from "./control-kpi-strip";
import { ControlQueue } from "./control-queue";
import type { AvailableDriver } from "./driver-assign-menu";
import type { ControlBooking } from "./types";
import type { EtaRefreshResult } from "@/lib/actions/eta-actions";

export type ControlConsolePageProps = {
  branchName: string;
  todayLabel: string;
  viewerRole: string;
  workspaceLabel: string;
  bookings: ControlBooking[];
  paymentAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  statusAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  assignDriverAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  availableDrivers?: AvailableDriver[];
  getTrackingLinkAction?: (input: unknown) => Promise<{ ok: boolean; message?: string; error?: string }>;
  refreshEtaAction?: (bookingId: string) => Promise<EtaRefreshResult>;
};

export function ControlConsolePage({
  branchName,
  todayLabel,
  viewerRole,
  workspaceLabel,
  bookings,
  paymentAction,
  statusAction,
  assignDriverAction,
  availableDrivers,
  getTrackingLinkAction,
  refreshEtaAction,
}: ControlConsolePageProps) {
  const active = bookings.filter((b) => b.status === "confirmed" || b.status === "in_progress");
  const inProgress = bookings.filter((b) => b.status === "in_progress");
  const completed = bookings.filter((b) => b.status === "completed");
  const unpaid = bookings.filter((b) => (b.payment_status ?? "unpaid") === "unpaid" || (b.payment_status ?? "unpaid") === "pending");
  const homeService = bookings.filter((b) => b.type === "home_service");
  const issues = bookings.filter(
    (b) =>
      !!b.dispatch_warning ||
      !!b.needs_location_review ||
      !!b.no_driver_warning ||
      (!b.resource_name && b.type !== "home_service") ||
      !b.staff_name
  );

  const kpiData = {
    total: bookings.length,
    active: active.length,
    inProgress: inProgress.length,
    completed: completed.length,
    unpaid: unpaid.length,
    homeService: homeService.length,
    issues: issues.length,
  };

  return (
    <div>
      <PageHeader
        title="Control"
        description={`${branchName} · ${todayLabel} · ${workspaceLabel}`}
      />

      <ControlKpiStrip data={kpiData} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <ControlQueue
            bookings={bookings}
            viewerRole={viewerRole}
            paymentAction={paymentAction}
            statusAction={statusAction}
            assignDriverAction={assignDriverAction}
            availableDrivers={availableDrivers}
            getTrackingLinkAction={getTrackingLinkAction}
            refreshEtaAction={refreshEtaAction}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Operational summary side rail */}
          <div
            className="cs-card"
            style={{ padding: "1rem 1.25rem" }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "0.75rem",
              }}
            >
              Operational Summary
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <SummaryRow label="Active bookings" value={active.length} />
              <SummaryRow label="In progress" value={inProgress.length} />
              <SummaryRow label="Completed today" value={completed.length} />
              <SummaryRow label="Unpaid / Pending" value={unpaid.length} highlight={unpaid.length > 0} />
              <SummaryRow label="Home service" value={homeService.length} />
              <SummaryRow label="Issues flagged" value={issues.length} highlight={issues.length > 0} danger={issues.length > 0} />
            </div>
          </div>

          {/* Staff availability placeholder */}
          <div
            className="cs-card"
            style={{ padding: "1rem 1.25rem" }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "0.75rem",
              }}
            >
              Staff Availability
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
              Staff availability diagnostics are shown on the{" "}
              <Link href="/manager/schedule" style={{ color: "var(--cs-sand)", fontWeight: 600, textDecoration: "none" }}>
                Schedule
              </Link>{" "}
              page.
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: "0.5rem" }}>
              Staff not showing? Use{" "}
              <Link href="/manager/staff" style={{ color: "var(--cs-sand)", fontWeight: 600, textDecoration: "none" }}>
                Staff Settings
              </Link>{" "}
              to check schedules and overrides.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>{label}</span>
      <span
        style={{
          fontSize: "0.875rem",
          fontWeight: 700,
          color: danger ? "#EF4444" : highlight ? "var(--cs-sand)" : "var(--cs-text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
