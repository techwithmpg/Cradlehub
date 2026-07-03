"use client";

import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2, Home, MessageSquare, Plus, ShieldAlert, Users } from "lucide-react";
import { CrmTodayHeader } from "./crm-today-header";
import { CrmPanel } from "./crm-panel";
import { CrmDrawer, useCrmDrawer } from "./crm-drawer";
import { CrmReadinessDetail } from "./crm-readiness-detail";
import { WorkQueuePanel, type WorkQueueBooking } from "./work-queue-panel";
import { AttendanceScanFeedCard } from "@/components/features/attendance/attendance-scan-feed-card";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import type { AvailableDriver } from "@/components/features/control-console/driver-assign-menu";
import type { EtaRefreshResult } from "@/lib/actions/eta-actions";
import { getWorkQueueNextAction } from "@/lib/crm/work-queue-next-actions";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";

type MutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;
type TrackingLinkAction = (input: unknown) => Promise<{ ok: boolean; message?: string; error?: string }>;

export function WorkQueueDashboard({
  branchName,
  dateLabel,
  roleLabel,
  viewerRole,
  queueData,
  snapshot,
  actionNotifications,
  attendanceScanFeed,
  attendanceScanDate,
  readinessIssues,
  readinessStatus,
  paymentAction,
  statusAction,
  assignDriverAction,
  availableDrivers,
  getTrackingLinkAction,
  refreshEtaAction,
}: {
  branchName: string;
  dateLabel: string;
  roleLabel: string;
  viewerRole: string;
  queueData: WorkQueueBooking[];
  snapshot: CrmTodaySnapshot;
  actionNotifications: { id: string; title: string; message?: string }[];
  attendanceScanFeed: AttendanceScanFeedData;
  attendanceScanDate: string;
  readinessIssues: ReadinessIssue[];
  readinessStatus: ReadinessStatus;
  paymentAction?: MutationAction;
  statusAction?: MutationAction;
  assignDriverAction?: MutationAction;
  availableDrivers?: AvailableDriver[];
  getTrackingLinkAction?: TrackingLinkAction;
  refreshEtaAction?: (bookingId: string) => Promise<EtaRefreshResult>;
}) {
  const readinessDrawer = useCrmDrawer();
  const { openBookingModal } = useAdministrativeBookingModal();
  const actionRows = queueData.map((booking) =>
    getWorkQueueNextAction({
      status: booking.status,
      type: booking.type,
      paymentStatus: booking.payment_status,
      staffName: booking.staff_name,
      resourceName: booking.resource_name,
      dispatchWarning: booking.dispatch_warning,
      needsLocationReview: booking.needs_location_review,
      noDriverWarning: booking.no_driver_warning,
    })
  );
  const needsActionCount = actionRows.filter((row) =>
    row.category === "confirmation" || row.category === "follow_up" || row.category === "exception"
  ).length;
  const homeServiceCount = queueData.filter((booking) => booking.type === "home_service").length;
  const readinessLabel =
    readinessStatus === "ok"
      ? "Ready"
      : readinessStatus === "warning"
      ? "Review warnings"
      : "Needs attention";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <CrmTodayHeader branchName={branchName} dateLabel={dateLabel} roleLabel={roleLabel} />

      <section
        aria-label="Work queue summary"
        style={{ display: "grid", gap: "0.75rem" }}
        className="grid-cols-1 md:grid-cols-3"
      >
        <SummaryCounter
          label="Needs Action"
          value={needsActionCount}
          detail="Confirmations, follow-ups, and exceptions"
          tone={needsActionCount > 0 ? "attention" : "calm"}
          icon={<ShieldAlert size={17} />}
        />
        <SummaryCounter
          label="Today"
          value={snapshot.bookingSummary.total}
          detail="Bookings in today's branch schedule"
          tone="neutral"
          icon={<CalendarDays size={17} />}
        />
        <SummaryCounter
          label="Home Service"
          value={homeServiceCount}
          detail="Dispatch and travel-aware bookings"
          tone={homeServiceCount > 0 ? "warm" : "neutral"}
          icon={<Home size={17} />}
        />
      </section>

      <div
        style={{ display: "grid", gap: "1.25rem", alignItems: "start" }}
        className="grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <main style={{ minWidth: 0 }}>
          <WorkQueuePanel
            bookings={queueData}
            viewerRole={viewerRole}
            paymentAction={paymentAction}
            statusAction={statusAction}
            assignDriverAction={assignDriverAction}
            availableDrivers={availableDrivers}
            getTrackingLinkAction={getTrackingLinkAction}
            refreshEtaAction={refreshEtaAction}
          />
        </main>

        <aside
          style={{ display: "flex", flexDirection: "column", gap: "0.875rem", minWidth: 0 }}
          className="xl:sticky xl:top-5 xl:self-start"
        >
          <AttendanceScanFeedCard
            workspace="crm"
            selectedDate={attendanceScanDate}
            branchId={attendanceScanFeed.branchId}
            branchName={branchName}
            feed={attendanceScanFeed}
          />

          <CrmPanel
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={16} style={{ color: "var(--cs-sand)" }} />
                Fast Actions
              </span>
            }
          >
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <SideButton label="New walk-in" onClick={() => openBookingModal({ mode: "walkin" })} />
              <SideLink href="/crm/customers?tab=followup" label="Add follow-up" />
              <SideLink href="/crm/schedule" label="Check schedule" />
            </div>
          </CrmPanel>

          <CrmPanel
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} style={{ color: readinessStatus === "ok" ? "var(--cs-success)" : "var(--cs-sand)" }} />
                Readiness
              </span>
            }
            action={
              <button
                type="button"
                onClick={() =>
                  readinessDrawer.openDrawer("System Readiness", <CrmReadinessDetail issues={readinessIssues} />)
                }
                style={sideButtonStyle}
              >
                Review
              </button>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <SideMetric label="Status" value={readinessLabel} highlight={readinessStatus !== "ok"} />
              <SideMetric label="Critical" value={String(readinessIssues.filter((issue) => issue.severity === "critical").length)} />
              <SideMetric label="Warnings" value={String(readinessIssues.filter((issue) => issue.severity === "warning").length)} />
            </div>
          </CrmPanel>

          <CrmPanel
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} style={{ color: "var(--cs-sand)" }} />
                Staff Coverage
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <SideMetric
                label="Available"
                value={`${snapshot.staffReadiness.availableNow}/${snapshot.staffReadiness.scheduledToday}`}
              />
              <SideMetric label="Busy" value={String(snapshot.staffReadiness.busyNow)} />
              <SideMetric
                label="Not checked in"
                value={String(snapshot.staffReadiness.notCheckedIn)}
                highlight={snapshot.staffReadiness.notCheckedIn > 0}
              />
            </div>
          </CrmPanel>

          {actionNotifications.length > 0 && (
            <CrmPanel
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Bell size={16} style={{ color: "var(--cs-info)" }} />
                  Notifications
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {actionNotifications.slice(0, 3).map((notification) => (
                  <div key={notification.id} style={notificationStyle}>
                    <div style={{ fontWeight: 700, color: "var(--cs-text)" }}>{notification.title}</div>
                    {notification.message && (
                      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                        {notification.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CrmPanel>
          )}
        </aside>
      </div>

      <CrmDrawer open={readinessDrawer.open} onOpenChange={readinessDrawer.setOpen} title={readinessDrawer.title}>
        {readinessDrawer.content}
      </CrmDrawer>

      <div style={footerStyle}>
        Signed in as {roleLabel} · {branchName}
      </div>
    </div>
  );
}

function SummaryCounter({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "attention" | "calm" | "neutral" | "warm";
  icon: React.ReactNode;
}) {
  const colors = {
    attention: { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B" },
    calm: { bg: "#ECFDF5", border: "#BBF7D0", color: "#065F46" },
    neutral: { bg: "var(--cs-surface)", border: "var(--cs-border-soft)", color: "var(--cs-text)" },
    warm: { bg: "#FFF7ED", border: "#FED7AA", color: "#92400E" },
  }[tone];

  return (
    <div
      className="cs-card"
      style={{
        padding: "0.875rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: "var(--cs-r-md)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--cs-r-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.color,
          background: "rgba(255,255,255,0.65)",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: "1.35rem", lineHeight: 1, fontWeight: 800, color: colors.color }}>
            {value}
          </span>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--cs-text)" }}>{label}</span>
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--cs-text-muted)", marginTop: 4 }}>{detail}</div>
      </div>
    </div>
  );
}

function SideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 36,
        padding: "0 0.75rem",
        borderRadius: "var(--cs-r-sm)",
        border: "1px solid var(--cs-border-soft)",
        color: "var(--cs-text)",
        background: "var(--cs-surface-warm)",
        textDecoration: "none",
        fontSize: "0.8125rem",
        fontWeight: 700,
      }}
    >
      <span>{label}</span>
      <MessageSquare size={14} style={{ color: "var(--cs-text-muted)" }} />
    </Link>
  );
}

function SideButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 36,
        padding: "0 0.75rem",
        borderRadius: "var(--cs-r-sm)",
        border: "1px solid var(--cs-border-soft)",
        color: "var(--cs-text)",
        background: "var(--cs-surface-warm)",
        textDecoration: "none",
        fontSize: "0.8125rem",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      <span>{label}</span>
      <MessageSquare size={14} style={{ color: "var(--cs-text-muted)" }} />
    </button>
  );
}

function SideMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.45rem 0.55rem",
        borderRadius: "var(--cs-r-sm)",
        background: "var(--cs-surface-warm)",
      }}
    >
      <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{label}</span>
      <span
        style={{
          fontSize: "0.8125rem",
          fontWeight: 800,
          color: highlight ? "#B45309" : "var(--cs-text)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const sideButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: "0 0.65rem",
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  background: "var(--cs-surface)",
  color: "var(--cs-text)",
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: 700,
};

const notificationStyle: React.CSSProperties = {
  padding: "0.55rem 0.65rem",
  borderRadius: "var(--cs-r-sm)",
  background: "var(--cs-surface-warm)",
  fontSize: "0.8125rem",
  color: "var(--cs-text-secondary)",
};

const footerStyle: React.CSSProperties = {
  marginTop: "0.5rem",
  paddingTop: "0.75rem",
  borderTop: "1px solid var(--cs-border-soft)",
  fontSize: "0.6875rem",
  color: "var(--cs-text-muted)",
  lineHeight: 1.5,
};
