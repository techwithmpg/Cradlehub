"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Leaf,
  Home,
  Plus,
  CalendarDays,
  Users,
  Zap,
  AlertCircle,
  ChevronRight,
  MessageSquare,
  Bell,
} from "lucide-react";
import { CrmTodayHeader } from "./crm-today-header";
import { CrmTodayTabBar, type TodayTabKey } from "./crm-today-tab-bar";
import { CrmStatusChipRow } from "./crm-status-chip-row";
import { CrmMetricGrid, type MetricItem } from "./crm-metric-grid";
import { CrmPanel } from "./crm-panel";
import { CrmDrawer } from "./crm-drawer";
import { useCrmDrawer } from "./crm-drawer";
import { CrmQuickActionGrid } from "./crm-quick-action-grid";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const TodayOverviewTab = dynamic(() => import("./tabs/today-overview-tab").then((m) => m.TodayOverviewTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const TodayControlCenterTab = dynamic(() => import("./tabs/today-control-center-tab").then((m) => m.TodayControlCenterTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const TodayPaymentsPendingTab = dynamic(() => import("./tabs/today-payments-pending-tab").then((m) => m.TodayPaymentsPendingTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const TodayActionRequiredTab = dynamic(() => import("./tabs/today-action-required-tab").then((m) => m.TodayActionRequiredTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const TodayEndOfDayTab = dynamic(() => import("./tabs/today-end-of-day-tab").then((m) => m.TodayEndOfDayTab), {
  loading: () => <TabSkeleton rows={4} />,
});

function TabSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
import type { BookingListItemData } from "./crm-booking-list-item";
import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import { CrmReadinessDetail } from "./crm-readiness-detail";

const TAB_PARAM = "tab";
const DEFAULT_TAB: TodayTabKey = "overview";

function getTabFromSearchParams(sp: URLSearchParams): TodayTabKey {
  const raw = sp.get(TAB_PARAM);
  const valid: TodayTabKey[] = ["overview", "control-center", "payments", "actions", "end-of-day"];
  return valid.includes(raw as TodayTabKey) ? (raw as TodayTabKey) : DEFAULT_TAB;
}

export function CrmTodayShell({
  branchName,
  dateLabel,
  roleLabel,
  queueData,
  snapshot,
  actionNotifications,
  readinessIssues,
  readinessStatus,
  nextApptId,
}: {
  branchName: string;
  dateLabel: string;
  roleLabel: string;
  queueData: BookingListItemData[];
  snapshot: CrmTodaySnapshot;
  actionNotifications: { id: string; title: string; message?: string }[];
  readinessIssues: ReadinessIssue[];
  readinessStatus: ReadinessStatus;
  nextApptId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getTabFromSearchParams(searchParams);
  const readinessDrawer = useCrmDrawer();

  const setTab = useCallback(
    (tab: TodayTabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === DEFAULT_TAB) {
        params.delete(TAB_PARAM);
      } else {
        params.set(TAB_PARAM, tab);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const pendingPaymentsCount = useMemo(
    () => queueData.filter((b) => b.payment_status !== "paid" && b.status !== "cancelled" && b.status !== "no_show").length,
    [queueData]
  );

  const actionRequiredCount = useMemo(() => {
    const unreadNotifs = actionNotifications.length;
    const criticalReadiness = readinessIssues.filter((i) => i.severity === "critical").length;
    const unassigned = queueData.filter((b) => b.status === "confirmed" && !b.staff_name).length;
    return unreadNotifs + criticalReadiness + unassigned;
  }, [actionNotifications, readinessIssues, queueData]);

  const metrics: MetricItem[] = useMemo(() => {
    return [
      {
        label: "Total Bookings",
        value: snapshot.bookingSummary.total,
        color: "#5A8A6A",
        icon: <Calendar size={16} />,
        trend: "Scheduled today",
      },
      {
        label: "Confirmed",
        value: snapshot.bookingSummary.confirmed,
        color: "#5A8A6A",
        icon: <CheckCircle2 size={16} />,
        trend: "Ready to serve",
      },
      {
        label: "In Progress",
        value: snapshot.bookingSummary.in_progress,
        color: "#8A7A5A",
        icon: <Clock size={16} />,
        trend: "Currently serving",
      },
      {
        label: "Completed",
        value: snapshot.bookingSummary.completed,
        color: "#5A8A6A",
        icon: <Leaf size={16} />,
        trend: "Finished today",
      },
      {
        label: "Home Service",
        value: snapshot.dispatchStats.totalToday,
        color: "#8A7A5A",
        icon: <Home size={16} />,
        trend: "Dispatch today",
      },
    ];
  }, [snapshot]);

  const renderTabPanel = () => {
    switch (activeTab) {
      case "overview":
        return <TodayOverviewTab queueData={queueData} nextApptId={nextApptId} />;
      case "control-center":
        return <TodayControlCenterTab queueData={queueData} />;
      case "payments":
        return <TodayPaymentsPendingTab queueData={queueData} paymentSummary={snapshot.payment} />;
      case "actions":
        return (
          <TodayActionRequiredTab
            readinessIssues={readinessIssues}
            actionNotifications={actionNotifications}
            queueData={queueData}
          />
        );
      case "end-of-day":
        return (
          <TodayEndOfDayTab
            paymentSummary={snapshot.payment}
            completedCount={snapshot.bookingSummary.completed}
            cancelledCount={snapshot.bookingSummary.cancelled + snapshot.bookingSummary.no_show}
            totalCount={snapshot.bookingSummary.total}
          />
        );
      default:
        return null;
    }
  };

  const renderRightRail = () => {
    // Overview tab right rail
    if (activeTab === "overview") {
      const needsAttentionItems = [
        ...(pendingPaymentsCount > 0
          ? [{ label: "Payments pending", value: pendingPaymentsCount, color: "var(--cs-error)" }]
          : []),
        ...(actionRequiredCount > 0
          ? [{ label: "Action required", value: actionRequiredCount, color: "var(--cs-error)" }]
          : []),
        ...(readinessIssues.filter((i) => i.severity === "critical").length > 0
          ? [{ label: "Critical issues", value: readinessIssues.filter((i) => i.severity === "critical").length, color: "var(--cs-error)" }]
          : []),
        ...(readinessIssues.filter((i) => i.severity === "warning").length > 0
          ? [{ label: "Warnings", value: readinessIssues.filter((i) => i.severity === "warning").length, color: "var(--cs-warning)" }]
          : []),
        ...(queueData.filter((b) => b.status === "confirmed" && !b.staff_name).length > 0
          ? [{ label: "Unassigned bookings", value: queueData.filter((b) => b.status === "confirmed" && !b.staff_name).length, color: "var(--cs-info)" }]
          : []),
      ];

      return (
        <>
          {/* Quick Actions */}
          <CrmPanel
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} style={{ color: "var(--cs-sand)" }} />
                Quick Actions
              </span>
            }
          >
            <CrmQuickActionGrid
              actions={[
                { label: "New Walk-in", href: "/crm/bookings/new?type=walkin", icon: <Plus size={16} />, primary: true },
                { label: "Add Follow-up", href: "/crm/notifications", icon: <MessageSquare size={16} /> },
                { label: "Block Time", href: "/crm/schedule", icon: <Clock size={16} /> },
                { label: "Check Availability", href: "/crm/availability", icon: <CalendarDays size={16} /> },
              ]}
            />
          </CrmPanel>

          {/* Staff Readiness */}
          <CrmPanel
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} style={{ color: "var(--cs-sand)" }} />
                Staff Readiness
              </span>
            }
            action={
              <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontWeight: 500 }}>
                View all
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { label: "Available Now", value: snapshot.staffReadiness.availableNow, total: snapshot.staffReadiness.scheduledToday, color: "var(--cs-success)" },
                { label: "Busy", value: snapshot.staffReadiness.busyNow, total: snapshot.staffReadiness.scheduledToday, color: "var(--cs-sand)" },
                { label: "Not Checked In", value: snapshot.staffReadiness.notCheckedIn, total: snapshot.staffReadiness.scheduledToday, color: snapshot.staffReadiness.notCheckedIn > 0 ? "var(--cs-info)" : "var(--cs-text-muted)" },
                { label: "Off Duty", value: snapshot.staffReadiness.offToday, total: snapshot.staffReadiness.total, color: "var(--cs-text-muted)" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.4rem 0.5rem",
                    borderRadius: "var(--cs-r-sm)",
                    backgroundColor: "var(--cs-surface-warm)",
                  }}
                >
                  <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{row.label}</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: row.color, minWidth: 40, textAlign: "right" }}>
                    {row.value} / {row.total}
                  </span>
                </div>
              ))}
            </div>
          </CrmPanel>

          {/* Needs Attention */}
          {needsAttentionItems.length > 0 && (
            <CrmPanel
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={16} style={{ color: "var(--cs-error)" }} />
                  Needs Attention
                </span>
              }
              action={
                <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontWeight: 500 }}>
                  View all
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {needsAttentionItems.map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.4rem 0.5rem",
                      borderRadius: "var(--cs-r-sm)",
                      backgroundColor: "var(--cs-surface-warm)",
                      cursor: "pointer",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--cs-sand-tint)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--cs-surface-warm)";
                    }}
                  >
                    <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{row.label}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.875rem", fontWeight: 700, color: row.color }}>
                      {row.value}
                      <ChevronRight size={14} style={{ opacity: 0.5 }} />
                    </span>
                  </div>
                ))}
              </div>
            </CrmPanel>
          )}

          {/* Notifications */}
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
                {actionNotifications.slice(0, 3).map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "0.5rem 0.625rem",
                      borderRadius: "var(--cs-r-sm)",
                      background: "var(--cs-surface-warm)",
                      fontSize: "0.8125rem",
                      color: "var(--cs-text-secondary)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--cs-text)" }}>{n.title}</div>
                    {n.message && <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>{n.message}</div>}
                  </div>
                ))}
              </div>
            </CrmPanel>
          )}
        </>
      );
    }

    // Fallback right rail for other tabs
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const dayProgress = Math.min(100, Math.round((nowMins / (24 * 60)) * 100));

    return (
      <>
        <CrmPanel title="Day Progress">
          <div style={{ height: 6, borderRadius: 3, background: "var(--cs-surface-warm)", overflow: "hidden", marginBottom: "0.75rem" }}>
            <div style={{ height: "100%", width: `${dayProgress}%`, background: "var(--cs-sand)", borderRadius: 3, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              { label: "Completed", value: snapshot.bookingSummary.completed, color: "var(--cs-success)" },
              { label: "In Progress", value: snapshot.bookingSummary.in_progress, color: "var(--cs-sand)" },
              { label: "Upcoming", value: snapshot.bookingSummary.confirmed, color: "var(--cs-info)" },
              { label: "Cancelled / No-show", value: snapshot.bookingSummary.cancelled + snapshot.bookingSummary.no_show, color: "var(--cs-error)" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", borderRadius: "var(--cs-r-sm)", backgroundColor: "var(--cs-surface-warm)" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{row.label}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: row.color, minWidth: 20, textAlign: "center" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </CrmPanel>

        <CrmPanel title="Staff Readiness">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {[
              { label: "Available Now", value: snapshot.staffReadiness.availableNow, color: "var(--cs-success)" },
              { label: "Busy", value: snapshot.staffReadiness.busyNow, color: "var(--cs-sand)" },
              { label: "Not Checked In", value: snapshot.staffReadiness.notCheckedIn, color: snapshot.staffReadiness.notCheckedIn > 0 ? "var(--cs-info)" : "var(--cs-text-muted)" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.625rem", borderRadius: "var(--cs-r-sm)", backgroundColor: "var(--cs-surface-warm)" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{row.label}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: row.color, minWidth: 18, textAlign: "right" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </CrmPanel>
      </>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <CrmTodayHeader branchName={branchName} dateLabel={dateLabel} roleLabel={roleLabel} />

      <CrmTodayTabBar activeTab={activeTab} onTabChange={setTab} />

      <CrmStatusChipRow
        readinessStatus={readinessStatus}
        readinessIssues={readinessIssues}
        pendingPaymentsCount={pendingPaymentsCount}
        actionRequiredCount={actionRequiredCount}
        onOpenReadiness={() =>
          readinessDrawer.openDrawer("System Readiness", <CrmReadinessDetail issues={readinessIssues} />)
        }
        onSwitchTab={(tab) => setTab(tab)}
      />

      <CrmMetricGrid metrics={metrics} />

      {/* Main Dashboard Grid */}
      <div
        style={{ display: "grid", gap: "1.25rem", alignItems: "start" }}
        className="grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        {/* Left column */}
        <main style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
          {renderTabPanel()}
        </main>

        {/* Right rail */}
        <aside
          style={{ display: "flex", flexDirection: "column", gap: "0.875rem", minWidth: 0 }}
          className="lg:sticky lg:top-5 lg:self-start"
        >
          {renderRightRail()}
        </aside>
      </div>

      {/* Readiness Drawer */}
      <CrmDrawer open={readinessDrawer.open} onOpenChange={readinessDrawer.setOpen} title={readinessDrawer.title}>
        {readinessDrawer.content}
      </CrmDrawer>

      {/* Footer */}
      <div style={{ marginTop: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--cs-border-soft)", fontSize: "0.6875rem", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
        Signed in as {roleLabel} · {branchName}
      </div>
    </div>
  );
}
