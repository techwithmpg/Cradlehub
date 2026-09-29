"use client";

import { CrmPanel } from "../crm-panel";
import { CrmEmptyState } from "../crm-empty-state";
import { CrmActionItem } from "../crm-action-item";
import type { ReadinessIssue } from "@/types/readiness";
import type { BookingListItemData } from "../crm-booking-list-item";
import { isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";
import { getCradleFlowPaymentStatus, getCradleFlowBalance } from "@/lib/crm/cradle-flow";

export function TodayActionRequiredTab({
  readinessIssues,
  actionNotifications,
  queueData,
}: {
  readinessIssues: ReadinessIssue[];
  actionNotifications: { id: string; title: string; message?: string }[];
  queueData: BookingListItemData[];
}) {
  const unassigned = queueData.filter((b) => b.status === "confirmed" && !b.staff_name);
  const seenPaymentOrders = new Set<string>();
  const unpaid = queueData.filter((b) => {
    if (getCradleFlowPaymentStatus(b) === "paid" || isBookingClosedForCrm(b.status)) return false;
    if (!b.order_id) return true;
    if (seenPaymentOrders.has(b.order_id)) return false;
    seenPaymentOrders.add(b.order_id);
    return true;
  });
  const homeServiceIssues = queueData.filter((b) => b.type === "home_service" && (b.needs_location_review || b.dispatch_warning));
  const staffScheduleIssues = queueData.filter(
    (b) => b.needs_staff_schedule_review
  );

  // Build action items from real data
  const actionItems = [
    ...staffScheduleIssues.map((b) => ({
      id: `staff-schedule-${b.id}`,
      title: `Staff preference review: ${b.customer_name ?? "Unnamed"}`,
      description:
        b.staff_schedule_exception_label ??
        "The customer-selected staff preference needs schedule review.",
      category: "Bookings",
      severity: "warning" as const,
      actionLabel: "Review Booking",
      actionHref: `/crm/bookings?bookingId=${b.id}`,
    })),
    ...unpaid.map((b) => ({
      id: `payment-${b.id}`,
      title: `Payment pending for ${b.customer_name ?? "Unnamed"}`,
      description: `${b.order_id ? "Order" : b.service_name ?? "Service"} · ₱${getCradleFlowBalance(b).toLocaleString()} outstanding`,
      category: "Payments",
      severity: "warning" as const,
      actionLabel: "Review Payment",
      actionHref: b.order_id ? "/crm/cash-flow" : `/crm/bookings?bookingId=${b.id}`,
    })),
    ...unassigned.map((b) => ({
      id: `unassigned-${b.id}`,
      title: `Unassigned booking: ${b.customer_name ?? "Unnamed"}`,
      description: `${b.service_name ?? "Service"} at ${b.start_time.slice(0, 5)}`,
      category: "Bookings",
      severity: "warning" as const,
      actionLabel: "Assign Therapist",
      actionHref: `/crm/bookings?bookingId=${b.id}`,
    })),
    ...homeServiceIssues.map((b) => ({
      id: `hs-${b.id}`,
      title: `Home service issue: ${b.customer_name ?? "Unnamed"}`,
      description: b.dispatch_warning ?? "Location needs review",
      category: "Dispatch",
      severity: "critical" as const,
      actionLabel: "Review Dispatch",
      actionHref: `/crm/dispatch`,
    })),
    ...readinessIssues
      .filter((i) => i.severity !== "success")
      .map((i) => ({
        id: `readiness-${i.id}`,
        title: i.title,
        description: i.problem ?? i.impact ?? "",
        category: i.scope.replace(/_/g, " "),
        severity: (i.severity === "critical" ? "critical" : i.severity === "warning" ? "warning" : "info") as "critical" | "warning" | "info",
        actionLabel: i.actionLabel ?? "Review",
        actionHref: i.actionHref,
      })),
    ...actionNotifications.map((n) => ({
      id: `notif-${n.id}`,
      title: n.title,
      description: n.message ?? "",
      category: "Notification",
      severity: "info" as const,
      actionLabel: "View",
      actionHref: "/crm/notifications",
    })),
  ];

  const critical = actionItems.filter((a) => a.severity === "critical");
  const warning = actionItems.filter((a) => a.severity === "warning");
  const info = actionItems.filter((a) => a.severity === "info");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {actionItems.length === 0 ? (
        <CrmPanel>
          <CrmEmptyState
            title="No urgent actions"
            description="Everything that needs attention has been handled. The day looks smooth."
            icon="✓"
          />
        </CrmPanel>
      ) : (
        <>
          {critical.length > 0 && (
            <CrmPanel
              title="Critical"
              action={
                <span style={{ fontSize: "0.75rem", color: "var(--cs-error)", fontWeight: 700 }}>
                  {critical.length}
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {critical.map((item) => (
                  <CrmActionItem key={item.id} item={item} />
                ))}
              </div>
            </CrmPanel>
          )}

          {warning.length > 0 && (
            <CrmPanel
              title="Needs Attention"
              action={
                <span style={{ fontSize: "0.75rem", color: "var(--cs-warning)", fontWeight: 700 }}>
                  {warning.length}
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {warning.map((item) => (
                  <CrmActionItem key={item.id} item={item} />
                ))}
              </div>
            </CrmPanel>
          )}

          {info.length > 0 && (
            <CrmPanel
              title="Notices"
              action={
                <span style={{ fontSize: "0.75rem", color: "var(--cs-info)", fontWeight: 700 }}>
                  {info.length}
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {info.map((item) => (
                  <CrmActionItem key={item.id} item={item} />
                ))}
              </div>
            </CrmPanel>
          )}
        </>
      )}
    </div>
  );
}
