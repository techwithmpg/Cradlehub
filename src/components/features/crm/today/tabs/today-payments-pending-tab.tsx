"use client";

import { useRouter } from "next/navigation";
import { CrmPanel } from "../crm-panel";
import { CrmEmptyState } from "../crm-empty-state";
import { CrmPaymentListItem } from "../crm-payment-list-item";
import type { BookingListItemData } from "../crm-booking-list-item";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import { isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";

export function TodayPaymentsPendingTab({
  queueData,
  paymentSummary,
}: {
  queueData: BookingListItemData[];
  paymentSummary: CrmTodayPayment | null;
}) {
  const router = useRouter();
  const pending = queueData.filter(
    (b) =>
      b.payment_status !== "paid" &&
      !isBookingClosedForCrm(b.status)
  );

  const byMethod: Record<string, number> = {};
  pending.forEach((b) => {
    const m = b.payment_method ?? "unknown";
    byMethod[m] = (byMethod[m] ?? 0) + 1;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Summary */}
      <CrmPanel title="Payment Summary">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {[
            {
              label: "Expected",
              value: paymentSummary?.total_expected ?? 0,
              color: "var(--cs-text)",
            },
            {
              label: "Collected",
              value: paymentSummary?.total_collected ?? 0,
              color: "var(--cs-success)",
            },
            {
              label: "Outstanding",
              value: paymentSummary?.total_unpaid ?? 0,
              color: "var(--cs-error)",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="cs-card"
              style={{
                padding: "0.75rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div style={{ fontSize: "1.125rem", fontWeight: 700, color: s.color, fontFamily: "var(--font-display)" }}>
                ₱{s.value.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </CrmPanel>

      {/* Pending Queue */}
      <CrmPanel
        title="Pending Payments Queue"
        action={
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontWeight: 600 }}>
            {pending.length} pending
          </span>
        }
      >
        {pending.length === 0 ? (
          <CrmEmptyState
            title="No pending payments"
            description="All confirmed bookings are paid or pay-on-site. Great work."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pending.map((b) => (
              <CrmPaymentListItem
                key={b.id}
                payment={{
                  id: b.id,
                  customer_name: b.customer_name,
                  service_name: b.service_name,
                  amount_paid: b.amount_paid,
                  price_paid: b.price_paid,
                  payment_status: b.payment_status,
                  payment_method: b.payment_method,
                  status: b.status,
                  start_time: b.start_time,
                }}
                onReview={() => {
                  router.push(`/crm/bookings?bookingId=${b.id}`);
                }}
              />
            ))}
          </div>
        )}
      </CrmPanel>

      {/* By Method Breakdown */}
      {Object.keys(byMethod).length > 0 && (
        <CrmPanel title="By Payment Method">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {Object.entries(byMethod).map(([method, count]) => (
              <div
                key={method}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--cs-r-sm)",
                  background: "var(--cs-surface-warm)",
                }}
              >
                <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", textTransform: "capitalize" }}>
                  {method.replace(/_/g, " ")}
                </span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CrmPanel>
      )}
    </div>
  );
}
