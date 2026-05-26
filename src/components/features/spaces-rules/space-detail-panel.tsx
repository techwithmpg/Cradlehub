"use client";

import Link from "next/link";
import {
  getResourceIcon,
  getResourceTypeLabel,
  getResourceStatus,
  getResourceStatusLabel,
  getResourceStatusColor,
  type ResourceRow,
  type ConflictBooking,
  type ResourceConflict,
} from "./spaces-rules-utils";
import { X, Users, MapPin, Power, Edit3, Calendar, AlertTriangle, ExternalLink } from "lucide-react";

// ── Original Space Detail Panel (Owner/Manager) ────────────────────────────────

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

// ── CRM Space Detail Panel ─────────────────────────────────────────────────────

export function CrmSpaceDetailPanel({
  resource,
  branchName,
  bookings,
  conflicts,
  canManage,
  onClose,
}: {
  resource: ResourceRow | null;
  branchName: string;
  bookings: ConflictBooking[];
  conflicts: ResourceConflict[];
  canManage: boolean;
  onClose: () => void;
}) {
  if (!resource) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "0.625rem",
          minHeight: 200,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: "var(--cs-surface-warm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MapPin size={16} style={{ color: "var(--cs-text-muted)" }} />
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          Select a space to view availability details.
        </div>
      </div>
    );
  }

  const status = getResourceStatus(resource, bookings, conflicts);
  const statusLabel = getResourceStatusLabel(status);
  const statusColor = getResourceStatusColor(status);

  // Get bookings for this resource
  const resourceBookings = bookings
    .filter(
      (b) =>
        b.resource_id === resource.id &&
        (b.status === "confirmed" ||
          b.status === "checked_in" ||
          b.status === "in_progress" ||
          b.status === "pending")
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Get conflicts for this resource
  const resourceConflicts = conflicts.filter(
    (c) =>
      (c.type === "overlap" || c.type === "capacity_overflow") &&
      c.resourceId === resource.id
  );

  return (
    <div
      className="cs-card"
      style={{
        padding: "1rem",
        position: "sticky",
        top: "1rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "0.875rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: "var(--cs-surface-warm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              opacity: resource.is_active ? 1 : 0.5,
            }}
          >
            {getResourceIcon(resource.type)}
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.3 }}>
              {resource.name}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)" }}>
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
          <X size={14} />
        </button>
      </div>

      {/* Status and capacity row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.875rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 12,
            backgroundColor:
              status === "available"
                ? "rgba(74, 124, 89, 0.1)"
                : status === "in_use"
                  ? "rgba(176, 136, 80, 0.1)"
                  : status === "conflict"
                    ? "rgba(220, 38, 38, 0.1)"
                    : "var(--cs-surface-warm)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: statusColor,
          }}
        >
          {statusLabel}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 12,
            backgroundColor: "var(--cs-surface-warm)",
            fontSize: "0.6875rem",
            fontWeight: 500,
            color: "var(--cs-text-secondary)",
          }}
        >
          <Users size={11} />
          Cap: {resource.capacity}
        </div>
      </div>

      {/* Conflicts warning */}
      {resourceConflicts.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "0.625rem",
            borderRadius: 6,
            backgroundColor: "rgba(220, 38, 38, 0.06)",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            marginBottom: "0.875rem",
          }}
        >
          <AlertTriangle size={14} style={{ color: "#DC2626", flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#DC2626" }}>
              {resourceConflicts.length} conflict{resourceConflicts.length !== 1 ? "s" : ""} on this resource
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
              Review and resolve overlapping bookings.
            </div>
          </div>
        </div>
      )}

      {/* Today's bookings */}
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.5rem",
        }}
      >
        Today&apos;s Bookings ({resourceBookings.length})
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          marginBottom: "1rem",
          maxHeight: 180,
          overflowY: "auto",
        }}
      >
        {resourceBookings.map((b) => (
          <div
            key={b.id}
            style={{
              padding: "0.5rem 0.625rem",
              borderRadius: 6,
              backgroundColor: "var(--cs-surface-warm)",
              fontSize: "0.6875rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--cs-text)" }}>
                {b.service_name ?? "Booking"}
              </span>
              <span style={{ color: "var(--cs-text-muted)" }}>
                {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 3,
              }}
            >
              <span style={{ color: "var(--cs-text-muted)" }}>
                {b.customer_name ?? "Guest"}
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 500,
                  color:
                    b.status === "checked_in"
                      ? "#4A7C59"
                      : b.status === "confirmed"
                        ? "#B08850"
                        : "var(--cs-text-muted)",
                }}
              >
                {b.status === "checked_in"
                  ? "Checked In"
                  : b.status === "confirmed"
                    ? "Confirmed"
                    : b.status}
              </span>
            </div>
          </div>
        ))}
        {resourceBookings.length === 0 && (
          <div
            style={{
              padding: "0.75rem",
              textAlign: "center",
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
            }}
          >
            No bookings on this space today.
          </div>
        )}
      </div>

      {/* Notes */}
      {resource.notes && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            marginBottom: "1rem",
            lineHeight: 1.5,
            padding: "0.5rem 0.625rem",
            borderRadius: 6,
            backgroundColor: "var(--cs-surface-warm)",
          }}
        >
          <span style={{ fontWeight: 600 }}>Notes: </span>
          {resource.notes}
        </div>
      )}

      {/* Quick actions */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--cs-border-soft)",
        }}
      >
        <Link
          href="/crm/bookings"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 0.625rem",
            borderRadius: 6,
            backgroundColor: "var(--cs-surface-warm)",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "var(--cs-text)",
            textDecoration: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={13} />
            View Bookings
          </span>
          <ExternalLink size={11} style={{ color: "var(--cs-text-muted)" }} />
        </Link>

        <Link
          href="/crm/availability"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 0.625rem",
            borderRadius: 6,
            backgroundColor: "var(--cs-surface-warm)",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "var(--cs-text)",
            textDecoration: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={13} />
            Live Availability
          </span>
          <ExternalLink size={11} style={{ color: "var(--cs-text-muted)" }} />
        </Link>

        {!canManage && (
          <div
            style={{
              fontSize: "0.6875rem",
              color: "var(--cs-text-muted)",
              textAlign: "center",
              marginTop: "0.375rem",
              fontStyle: "italic",
            }}
          >
            Contact manager to edit this resource.
          </div>
        )}

        {canManage && (
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "0.5rem",
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              backgroundColor: "var(--cs-surface)",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "var(--cs-text)",
              cursor: "pointer",
              marginTop: "0.25rem",
            }}
          >
            <Edit3 size={13} />
            Edit Resource
          </button>
        )}
      </div>
    </div>
  );
}
