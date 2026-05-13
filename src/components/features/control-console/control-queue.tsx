"use client";

import { useState } from "react";
import { ControlBookingCard } from "./control-booking-card";
import type { AvailableDriver } from "./driver-assign-menu";
import type { ControlBooking, ControlTab } from "./types";
import type { EtaRefreshResult } from "@/lib/actions/eta-actions";

const TAB_CONFIG: { key: ControlTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "home_service", label: "Home" },
  { key: "in_spa", label: "In Spa" },
  { key: "unpaid", label: "Unpaid" },
  { key: "issues", label: "Issues" },
];

export type ControlQueueProps = {
  bookings: ControlBooking[];
  viewerRole: string;
  paymentAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  statusAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  assignDriverAction?: (input: unknown) => Promise<{ success: boolean; error?: string }>;
  availableDrivers?: AvailableDriver[];
  getTrackingLinkAction?: (input: unknown) => Promise<{ ok: boolean; message?: string; error?: string }>;
  refreshEtaAction?: (bookingId: string) => Promise<EtaRefreshResult>;
};

export function ControlQueue({ bookings, viewerRole, paymentAction, statusAction, assignDriverAction, availableDrivers, getTrackingLinkAction, refreshEtaAction }: ControlQueueProps) {
  const [activeTab, setActiveTab] = useState<ControlTab>("all");

  const filtered = bookings.filter((b) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return b.status === "confirmed" || b.status === "in_progress";
    if (activeTab === "home_service") return b.type === "home_service";
    if (activeTab === "in_spa") return b.type !== "home_service";
    if (activeTab === "unpaid") return (b.payment_status ?? "unpaid") === "unpaid" || (b.payment_status ?? "unpaid") === "pending";
    if (activeTab === "issues") {
      return (
        !!b.dispatch_warning ||
        !!b.needs_location_review ||
        !!b.no_driver_warning ||
        (!b.resource_name && b.type !== "home_service") ||
        !b.staff_name
      );
    }
    return true;
  });

  const isIssue = (b: ControlBooking) =>
    !!b.dispatch_warning ||
    !!b.needs_location_review ||
    !!b.no_driver_warning ||
    (!b.resource_name && b.type !== "home_service") ||
    !b.staff_name;

  const tabCounts = {
    all: bookings.length,
    active: bookings.filter((b) => b.status === "confirmed" || b.status === "in_progress").length,
    home_service: bookings.filter((b) => b.type === "home_service").length,
    in_spa: bookings.filter((b) => b.type !== "home_service").length,
    unpaid: bookings.filter((b) => (b.payment_status ?? "unpaid") === "unpaid" || (b.payment_status ?? "unpaid") === "pending").length,
    issues: bookings.filter(isIssue).length,
  };

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: "0.875rem",
          flexWrap: "wrap",
        }}
      >
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              borderColor: activeTab === tab.key ? "var(--cs-sand)" : "var(--cs-border)",
              backgroundColor: activeTab === tab.key ? "var(--cs-sand-mist)" : "transparent",
              color: activeTab === tab.key ? "var(--cs-sand)" : "var(--cs-text-muted)",
            }}
          >
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  opacity: 0.75,
                }}
              >
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
          }}
        >
          No bookings match the selected filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((booking) => (
            <ControlBookingCard
              key={booking.id}
              booking={booking}
              viewerRole={viewerRole}
              paymentAction={paymentAction}
              statusAction={statusAction}
              assignDriverAction={assignDriverAction}
              availableDrivers={availableDrivers}
              getTrackingLinkAction={getTrackingLinkAction}
              refreshEtaAction={refreshEtaAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
