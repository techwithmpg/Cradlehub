"use client";

import { CrmPanel } from "../crm-panel";
import { CrmEmptyState } from "../crm-empty-state";
import { CrmBookingListItem } from "../crm-booking-list-item";
import type { BookingListItemData } from "../crm-booking-list-item";

export function TodayControlCenterTab({
  queueData,
}: {
  queueData: BookingListItemData[];
}) {
  const pending = queueData.filter((b) => b.status === "pending" || b.status === "pending_payment" || b.status === "pending_crm_confirmation");
  const confirmed = queueData.filter((b) => b.status === "confirmed");
  const inService = queueData.filter((b) => b.status === "in_progress");
  const completed = queueData.filter((b) => b.status === "completed");
  const homeService = queueData.filter((b) => b.type === "home_service");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Live Operations Queue */}
      <CrmPanel title="Live Operations Queue">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
          {[
            { label: "Pending", count: pending.length, color: "var(--cs-info)" },
            { label: "Confirmed", count: confirmed.length, color: "var(--cs-sand)" },
            { label: "In Service", count: inService.length, color: "var(--cs-warning)" },
            { label: "Completed", count: completed.length, color: "var(--cs-success)" },
            { label: "Home Service", count: homeService.length, color: "var(--cs-text-muted)" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="cs-card"
              style={{
                padding: "0.75rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: stat.color, fontFamily: "var(--font-display)" }}>
                {stat.count}
              </div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </CrmPanel>

      {/* In Service Now */}
      <CrmPanel title="In Service Now">
        {inService.length === 0 ? (
          <CrmEmptyState
            title="No bookings in progress"
            description="Confirmed bookings will appear here when service starts."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {inService.map((b) => (
              <CrmBookingListItem key={b.id} booking={b} />
            ))}
          </div>
        )}
      </CrmPanel>

      {/* Waiting / Confirmed */}
      <CrmPanel title="Waiting / Confirmed">
        {confirmed.length === 0 ? (
          <CrmEmptyState
            title="No confirmed bookings waiting"
            description="All confirmed bookings are either in progress or not yet arrived."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {confirmed.slice(0, 8).map((b) => (
              <CrmBookingListItem key={b.id} booking={b} />
            ))}
          </div>
        )}
      </CrmPanel>

      {/* Home Service / Dispatch */}
      {homeService.length > 0 && (
        <CrmPanel title="Home Service / Dispatch">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {homeService.map((b) => (
              <CrmBookingListItem key={b.id} booking={b} />
            ))}
          </div>
        </CrmPanel>
      )}
    </div>
  );
}
