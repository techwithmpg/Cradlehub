"use client";

import {
  getResourceIcon,
  getResourceTypeLabel,
  type ResourceRow,
  type ConflictBooking,
} from "./spaces-rules-utils";
import { X, Users, MapPin, Power, Edit3 } from "lucide-react";

export function SpaceDetailPanel({
  resource,
  branchName,
  bookings,
  canManage,
  onClose,
}: {
  resource: ResourceRow | null;
  branchName: string;
  bookings: ConflictBooking[];
  canManage: boolean;
  onClose: () => void;
}) {
  if (!resource) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "0.75rem",
          minHeight: 240,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: "var(--cs-surface-warm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MapPin size={18} style={{ color: "var(--cs-text-muted)" }} />
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          Select a space to view details and today&apos;s bookings.
        </div>
      </div>
    );
  }

  const resourceBookings = bookings
    .filter(
      (b) =>
        b.resource_id === resource.id &&
        (b.status === "confirmed" || b.status === "checked_in" || b.status === "pending")
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="cs-card" style={{ padding: "1.25rem", position: "sticky", top: "1rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: "var(--cs-surface-warm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            {getResourceIcon(resource.type)}
          </div>
          <div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.3 }}>
              {resource.name}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
              {getResourceTypeLabel(resource.type)} · {branchName}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            color: "var(--cs-text-muted)",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            padding: "0.5rem 0.625rem",
            borderRadius: 6,
            backgroundColor: "var(--cs-surface-warm)",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          <Users size={13} style={{ color: "var(--cs-text-muted)" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Cap</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, marginLeft: "auto" }}>
            {resource.capacity}
          </span>
        </div>
        <div
          style={{
            padding: "0.5rem 0.625rem",
            borderRadius: 6,
            backgroundColor: "var(--cs-surface-warm)",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          <Power size={13} style={{ color: resource.is_active ? "#4A7C59" : "var(--cs-text-muted)" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Status</span>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              marginLeft: "auto",
              color: resource.is_active ? "#4A7C59" : "var(--cs-text-muted)",
            }}
          >
            {resource.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Description */}
      {resource.notes && (
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            marginBottom: "1rem",
            lineHeight: 1.5,
          }}
        >
          {resource.notes}
        </div>
      )}

      {/* Today's bookings */}
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.5rem",
        }}
      >
        Today&apos;s Bookings ({resourceBookings.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {resourceBookings.map((b) => (
          <div
            key={b.id}
            style={{
              padding: "0.5rem 0.625rem",
              borderRadius: 6,
              backgroundColor: "var(--cs-surface-warm)",
              fontSize: "0.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 500 }}>{b.service_name ?? "Booking"}</span>
              <span style={{ color: "var(--cs-text-muted)" }}>{b.start_time.slice(0, 5)}</span>
            </div>
            <div style={{ color: "var(--cs-text-muted)", marginTop: 2 }}>
              {b.customer_name ?? "Guest"}
            </div>
          </div>
        ))}
        {resourceBookings.length === 0 && (
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", padding: "0.5rem 0" }}>
            No bookings on this space today.
          </div>
        )}
      </div>

      {/* Actions */}
      {canManage && (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--cs-border)",
            display: "flex",
            gap: "0.5rem",
          }}
        >
          <button
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
              padding: "0.5rem",
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              backgroundColor: "var(--cs-surface)",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "var(--cs-text)",
              cursor: "pointer",
            }}
          >
            <Edit3 size={13} />
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
