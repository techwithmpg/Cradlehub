"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  Truck,
  MapPin,
  Clock,
  ChevronRight,
  Activity,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import type { BookingProgressStatus } from "@/lib/bookings/progress";

// Re-declare the same shape as DriverTrip in driver-trip-list.tsx
// This avoids modifying the existing desktop component
type DriverTrip = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  booking_progress_status: string;
  travel_buffer_mins: number | null;
  travel_started_at: string | null;
  arrived_at: string | null;
  session_started_at: string | null;
  session_completed_at: string | null;
  service_name: string;
  service_duration: number | null;
  customer_name: string;
  therapist_name: string | null;
  hs_address: string | null;
  hs_city: string | null;
  hs_zone: string | null;
  hs_map_url: string | null;
};

type DriverInfo = {
  id: string;
  full_name: string;
  system_role: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function formatTimePH(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

const PROGRESS_DISPLAY: Record<string, { label: string; color: string }> = {
  not_started: { label: "Ready", color: "#8A6A5A" },
  travel_started: { label: "En Route", color: "#5A6A8A" },
  arrived: { label: "Arrived", color: "#5A7A8A" },
  session_started: { label: "In Session", color: "#7E57C2" },
  completed: { label: "Completed", color: "#5A8A6A" },
};

function getNextDriverAction(status: string): { label: string; next: BookingProgressStatus } | null {
  switch (status) {
    case "not_started": return { label: "Start Trip", next: "travel_started" };
    case "travel_started": return { label: "Mark Arrived", next: "arrived" };
    default: return null;
  }
}

// ── Current trip card ─────────────────────────────────────────────────────────

function CurrentTripCard({ trip }: { trip: DriverTrip }) {
  const [localStatus, setLocalStatus] = useState(trip.booking_progress_status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nextAction = getNextDriverAction(localStatus);
  const progress = PROGRESS_DISPLAY[localStatus] ?? { label: localStatus, color: "var(--cs-sand)" };

  function handleAction(next: BookingProgressStatus) {
    if (isPending) return;
    startTransition(async () => {
      const res = await updateBookingProgressAction({ bookingId: trip.id, nextStatus: next });
      if (res.ok) {
        setLocalStatus(next);
        setError(null);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div
      style={{
        backgroundColor: "#EEF3F8",
        borderRadius: 16,
        border: "1px solid #C2D4E4",
        borderLeft: "3px solid #5A7A8A",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#2A4A6A",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Truck size={11} />
          Current Trip
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 100,
            backgroundColor: `${progress.color}18`,
            color: progress.color,
          }}
        >
          {progress.label}
        </div>
      </div>

      {/* Time + service */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
          {formatTimePH(trip.start_time)} · {trip.service_name}
        </div>
        <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", marginTop: 3 }}>
          {trip.customer_name}
          {trip.therapist_name && (
            <span style={{ color: "var(--cs-text-muted)" }}> · Therapist: {trip.therapist_name}</span>
          )}
        </div>
      </div>

      {/* Address */}
      {trip.hs_address && (
        <div
          style={{
            fontSize: 12,
            color: "var(--cs-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <MapPin size={12} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {trip.hs_address}
          </span>
        </div>
      )}

      {/* Map link */}
      {trip.hs_map_url && (
        <a
          href={trip.hs_map_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: "#2A4A6A",
            textDecoration: "none",
            backgroundColor: "rgba(90,120,138,0.08)",
            padding: "5px 10px",
            borderRadius: 8,
            alignSelf: "flex-start",
          }}
        >
          <Navigation size={12} />
          Open Route
        </a>
      )}

      {/* Action */}
      {nextAction && (
        <button
          onClick={() => handleAction(nextAction.next)}
          disabled={isPending}
          style={{
            width: "100%",
            padding: "0.625rem",
            borderRadius: 10,
            border: "none",
            backgroundColor: "#5A7A8A",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 46,
          }}
        >
          <Truck size={15} />
          {isPending ? "Updating…" : nextAction.label}
        </button>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#991B1B", backgroundColor: "#FEF2F2", padding: "5px 8px", borderRadius: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ── Upcoming trip card ────────────────────────────────────────────────────────

function UpcomingTripCard({ trip }: { trip: DriverTrip }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        border: "1px solid var(--cs-border-soft)",
        padding: "0.75rem 0.875rem",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.625rem",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Truck size={16} color="var(--cs-sand-dark)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            marginBottom: 2,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>
            {formatTimePH(trip.start_time)}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              backgroundColor: "var(--cs-sand-mist)",
              color: "var(--cs-sand-dark)",
              padding: "2px 6px",
              borderRadius: 100,
            }}
          >
            Upcoming
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--cs-text-secondary)" }}>
          {trip.customer_name} · {trip.service_name}
        </div>
        {trip.hs_address && (
          <div
            style={{
              fontSize: 11,
              color: "var(--cs-text-muted)",
              marginTop: 3,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <MapPin size={10} />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {trip.hs_address}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overview stats ────────────────────────────────────────────────────────────

function DriverOverview({ trips }: { trips: DriverTrip[] }) {
  const total = trips.length;
  const completed = trips.filter((t) => t.booking_progress_status === "completed").length;
  const inProgress = trips.filter((t) => t.booking_progress_status === "travel_started" || t.booking_progress_status === "arrived").length;
  const upcoming = trips.filter((t) => t.booking_progress_status === "not_started").length;

  const stats = [
    { label: "Total", value: String(total), color: "var(--cs-sand)" },
    { label: "In Progress", value: String(inProgress), color: "#5A6A8A" },
    { label: "Upcoming", value: String(upcoming), color: "var(--cs-info)" },
    { label: "Done", value: String(completed), color: "var(--cs-success)" },
  ];

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "0.875rem 1rem",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--cs-text-muted)",
          marginBottom: "0.75rem",
        }}
      >
        Today&apos;s Overview
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.5rem",
        }}
      >
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              textAlign: "center",
              backgroundColor: "var(--cs-surface-warm)",
              borderRadius: 10,
              padding: "0.5rem 0.25rem",
              border: "1px solid var(--cs-border-soft)",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 3, lineHeight: 1.2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type DriverMobileHomeProps = {
  driver: DriverInfo;
  trips: DriverTrip[];
};

export function DriverMobileHome({ driver, trips }: DriverMobileHomeProps) {
  const firstName = driver.full_name.split(" ")[0] ?? driver.full_name;

  const sorted = [...trips].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const currentTrip = sorted.find(
    (t) => t.booking_progress_status === "travel_started" || t.booking_progress_status === "arrived"
  ) ?? null;

  const upcomingTrips = sorted.filter(
    (t) => t.booking_progress_status === "not_started"
  );

  const completedTrips = sorted.filter(
    (t) => t.booking_progress_status === "completed"
  );

  const allDone = sorted.length > 0 && sorted.every((t) => t.booking_progress_status === "completed");

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          backgroundColor: "#fff",
          borderBottom: "1px solid var(--cs-border-soft)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--cs-text)",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            CradleHub
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#5A7A8A",
              marginTop: 1,
            }}
          >
            Driver Portal
          </div>
        </div>

        <Link
          href="/driver"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--cs-text-muted)",
            textDecoration: "none",
          }}
          aria-label="Notifications"
        >
          <Bell size={17} />
        </Link>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {/* Greeting */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            border: "1px solid var(--cs-border-soft)",
            padding: "1rem 1.125rem",
            boxShadow: "var(--cs-shadow-xs)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--cs-text)",
                  lineHeight: 1.2,
                }}
              >
                Good {getGreeting()}, {firstName} 👋
              </h1>
              <p style={{ margin: "0.25rem 0 0", fontSize: 13, color: "var(--cs-text-secondary)" }}>
                {new Date().toLocaleDateString("en-PH", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                backgroundColor: "var(--cs-success-bg)",
                color: "var(--cs-success)",
                borderRadius: 100,
                padding: "0.3rem 0.625rem",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                border: "1px solid rgba(90,138,106,0.18)",
              }}
            >
              <Activity size={12} />
              On Duty
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: "var(--cs-text-muted)" }}>
            {sorted.length === 0
              ? "No trips assigned today."
              : `${sorted.length} trip${sorted.length !== 1 ? "s" : ""} today · ${completedTrips.length} completed.`}
          </p>
        </div>

        {/* All done */}
        {allDone && (
          <div
            style={{
              backgroundColor: "var(--cs-success-bg)",
              borderRadius: 14,
              border: "1px solid rgba(90,138,106,0.25)",
              padding: "1rem 1.125rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <CheckCircle2 size={22} color="var(--cs-success)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-text)" }}>
                All trips completed!
              </div>
              <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
                Great work today.
              </div>
            </div>
          </div>
        )}

        {/* Current trip */}
        {currentTrip && <CurrentTripCard trip={currentTrip} />}

        {/* Overview */}
        {sorted.length > 0 && <DriverOverview trips={sorted} />}

        {/* Upcoming trips */}
        {upcomingTrips.length > 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              border: "1px solid var(--cs-border-soft)",
              padding: "0.875rem 1rem",
              boxShadow: "var(--cs-shadow-xs)",
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--cs-text-muted)",
              }}
            >
              Upcoming Trips
            </div>
            {upcomingTrips.map((t) => (
              <UpcomingTripCard key={t.id} trip={t} />
            ))}
          </div>
        )}

        {/* No trips */}
        {sorted.length === 0 && (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              border: "1px solid var(--cs-border-soft)",
              padding: "2rem 1.125rem",
              textAlign: "center",
              boxShadow: "var(--cs-shadow-xs)",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: "0.5rem" }}>🚗</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
              No trips assigned
            </div>
            <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
              You have no dispatch trips today. Check back later.
            </div>
          </div>
        )}

        {/* Link to full dispatch */}
        <Link
          href="/driver/dispatch"
          style={{
            textDecoration: "none",
            backgroundColor: "#fff",
            borderRadius: 12,
            border: "1px solid var(--cs-border-soft)",
            padding: "0.875rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "var(--cs-shadow-xs)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Truck size={16} color="var(--cs-sand-dark)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>
                Dispatch Console
              </div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
                Full trip management and routing
              </div>
            </div>
          </div>
          <ChevronRight size={16} color="var(--cs-text-muted)" />
        </Link>

        {/* Quick action row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
          }}
        >
          {[
            { label: "Start Break", color: "var(--cs-sand-mist)", textColor: "var(--cs-sand-dark)" },
            { label: "Off Duty", color: "var(--cs-neutral-bg)", textColor: "var(--cs-neutral-text)" },
            { label: "Emergency", color: "var(--cs-error-bg)", textColor: "var(--cs-error-text)" },
          ].map(({ label, color, textColor }) => (
            <button
              key={label}
              type="button"
              style={{
                padding: "0.625rem 0.375rem",
                borderRadius: 10,
                border: "1px solid var(--cs-border-soft)",
                backgroundColor: color,
                color: textColor,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => {
                // Placeholder — connect to action flow in follow-up task
                alert(`${label}: Please contact your manager.`);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Timing indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: 11,
            color: "var(--cs-text-muted)",
            justifyContent: "center",
            paddingTop: "0.25rem",
          }}
        >
          <Clock size={11} />
          Live — updates when trip status changes
        </div>
      </div>
    </div>
  );
}
