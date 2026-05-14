"use client";

import { Bell, MapPin, Clock, Home as HomeIcon, CheckCircle2, Activity, ChevronRight } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { BookingProgressActions } from "@/components/features/staff-portal/booking-progress-actions";
import { formatTime } from "@/lib/utils";
import type { StaffPortalBooking, StaffPortalStaff } from "@/components/features/staff-portal/types";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import { StaffMobileBottomNav } from "./staff-mobile-bottom-nav";

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstRelation<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getBookingDuration(booking: StaffPortalBooking): number {
  const svc = firstRelation(booking.services);
  if (booking.start_time && booking.end_time) {
    const [sh, sm] = booking.start_time.split(":").map(Number);
    const [eh, em] = booking.end_time.split(":").map(Number);
    const diff = ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (diff > 0) return diff;
  }
  return svc?.duration_minutes ?? 60;
}

function statusColor(status: string): string {
  if (status === "completed") return "var(--cs-success)";
  if (status === "in_progress") return "var(--cs-sand)";
  if (status === "cancelled" || status === "no_show") return "var(--cs-text-muted)";
  return "var(--cs-sand)";
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending": return "Pending";
    case "confirmed": return "Confirmed";
    case "in_progress": return "In Progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "no_show": return "No Show";
    default: return status;
  }
}

// ── Top Bar ───────────────────────────────────────────────────────────────────

function TopBar({ staff }: { staff: StaffPortalStaff }) {
  const roleLabel = STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? "Staff";

  return (
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
            color: "var(--cs-staff-accent)",
            marginTop: 1,
          }}
        >
          Staff · {roleLabel}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <Link
          href="/staff-portal/notifications"
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

        <Link
          href="/staff-portal/profile"
          style={{ textDecoration: "none" }}
          aria-label="Profile"
        >
          <UserAvatar
            name={staff.full_name}
            imageUrl={staff.avatar_url}
            size="sm"
            className="size-9 border border-[--cs-border-soft] shadow-xs"
          />
        </Link>
      </div>
    </div>
  );
}

// ── Greeting card ─────────────────────────────────────────────────────────────

function GreetingCard({ staff, totalBookings }: { staff: StaffPortalStaff; totalBookings: number }) {
  const firstName = staff.full_name.split(" ")[0] ?? staff.full_name;
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
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
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: 13,
              color: "var(--cs-text-secondary)",
              lineHeight: 1.4,
            }}
          >
            {todayLabel}
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

      <p style={{ margin: 0, fontSize: 13, color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
        {totalBookings === 0
          ? "No assigned services today. Enjoy your day!"
          : `You have ${totalBookings} appointment${totalBookings !== 1 ? "s" : ""} scheduled today.`}
      </p>
    </div>
  );
}

// ── Next action card ──────────────────────────────────────────────────────────

function NextActionCard({ booking }: { booking: StaffPortalBooking }) {
  const customer = firstRelation(booking.customers);
  const service = firstRelation(booking.services);
  const duration = getBookingDuration(booking);
  const isHome = booking.type === "home_service";
  const address = (booking.metadata?.address as string | undefined) ?? (booking.metadata?.home_address as string | undefined);

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface-warm)",
        borderRadius: 16,
        border: "1px solid var(--cs-border)",
        borderLeft: `3px solid var(--cs-staff-accent)`,
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cs-staff-accent)",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <ChevronRight size={12} />
        Next Up · {formatTime(booking.start_time)}
      </div>

      {/* Main info */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
          {service?.name ?? "Appointment"}
        </div>
        <div style={{ fontSize: 13, color: "var(--cs-text-secondary)", marginTop: 3 }}>
          {customer?.full_name ?? "—"}
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 12,
            color: "var(--cs-text-muted)",
          }}
        >
          <Clock size={12} />
          {duration} min
        </span>

        {isHome ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 12,
              color: "var(--cs-text-muted)",
            }}
          >
            <HomeIcon size={12} />
            {address ? (
              <span
                style={{
                  maxWidth: 180,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {address}
              </span>
            ) : (
              "Home Service"
            )}
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 12,
              color: "var(--cs-text-muted)",
            }}
          >
            <MapPin size={12} />
            {booking.branch_resources
              ? `Room: ${booking.branch_resources.name}`
              : "In-Spa"}
          </span>
        )}
      </div>

      {/* Progress actions */}
      <BookingProgressActions booking={booking} />
    </div>
  );
}

// ── Today timeline ────────────────────────────────────────────────────────────

function TimelineItem({
  booking,
  isNext,
}: {
  booking: StaffPortalBooking;
  isNext: boolean;
}) {
  const customer = firstRelation(booking.customers);
  const service = firstRelation(booking.services);
  const duration = getBookingDuration(booking);
  const isHome = booking.type === "home_service";
  const accentColor = isHome
    ? "#7E57C2"
    : statusColor(booking.status);

  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        paddingBottom: "1rem",
        position: "relative",
      }}
    >
      {/* Left: time */}
      <div
        style={{
          width: 58,
          flexShrink: 0,
          textAlign: "right",
          paddingTop: 2,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
          {formatTime(booking.start_time)}
        </div>
        <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 1 }}>
          {formatTime(booking.end_time)}
        </div>
      </div>

      {/* Center: timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: accentColor,
            border: "2px solid #fff",
            boxShadow: `0 0 0 1.5px ${accentColor}`,
            flexShrink: 0,
            marginTop: 4,
          }}
        />
        <div
          style={{
            flex: 1,
            width: 1.5,
            backgroundColor: "var(--cs-border-soft)",
            marginTop: 4,
          }}
        />
      </div>

      {/* Right: booking card */}
      <div
        style={{
          flex: 1,
          backgroundColor: isNext ? "var(--cs-surface-warm)" : "#fff",
          borderRadius: 12,
          border: `1px solid ${isNext ? "var(--cs-border)" : "var(--cs-border-soft)"}`,
          padding: "0.625rem 0.75rem",
          marginBottom: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--cs-text)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {service?.name ?? "Appointment"}
            </div>
            <div style={{ fontSize: 12, color: "var(--cs-text-secondary)", marginTop: 2 }}>
              {customer?.full_name ?? "—"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--cs-text-muted)",
                marginTop: 2,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {isHome ? <HomeIcon size={10} /> : <MapPin size={10} />}
              {isHome
                ? "Home Service"
                : booking.branch_resources
                ? booking.branch_resources.name
                : "In-Spa"}
              <span style={{ opacity: 0.6 }}>·</span>
              <Clock size={10} />
              {duration} min
            </div>
          </div>

          {/* Status badge */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 100,
              backgroundColor: `${accentColor}18`,
              color: accentColor,
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {statusLabel(booking.status)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TodayTimeline({ bookings, nextBookingId }: { bookings: StaffPortalBooking[]; nextBookingId: string | null }) {
  if (bookings.length === 0) {
    return (
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
        <div style={{ fontSize: 28, marginBottom: "0.5rem" }}>🌿</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          You&apos;re clear for today
        </div>
        <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
          No assigned services. New bookings will appear here automatically.
        </div>
      </div>
    );
  }

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
          marginBottom: "0.875rem",
        }}
      >
        Today&apos;s Schedule
      </div>

      <div>
        {bookings.map((b, i) => (
          <TimelineItem
            key={b.id}
            booking={b}
            isNext={b.id === nextBookingId && i === bookings.findIndex((x) => x.id === nextBookingId)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Today overview ────────────────────────────────────────────────────────────

function TodayOverview({ bookings }: { bookings: StaffPortalBooking[] }) {
  const total = bookings.length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const homeService = bookings.filter((b) => b.type === "home_service").length;

  const totalMinutes = bookings.reduce((sum, b) => sum + getBookingDuration(b), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeLabel = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

  const stats = [
    { label: "Total", value: String(total), color: "var(--cs-sand)" },
    { label: "Working", value: timeLabel, color: "var(--cs-info)" },
    { label: "Done", value: String(completed), color: "var(--cs-success)" },
    { label: "Home Svc", value: String(homeService), color: "#7E57C2" },
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
            <div
              style={{
                fontSize: 10,
                color: "var(--cs-text-muted)",
                marginTop: 3,
                lineHeight: 1.2,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Home service alert banner ─────────────────────────────────────────────────

function HomeServiceBanner({ booking }: { booking: StaffPortalBooking }) {
  const customer = firstRelation(booking.customers);
  const address = (booking.metadata?.address as string | undefined) ?? (booking.metadata?.home_address as string | undefined);

  return (
    <div
      style={{
        backgroundColor: "#EDE7F6",
        borderRadius: 14,
        border: "1px solid #B39DDB",
        borderLeft: "3px solid #7E57C2",
        padding: "0.875rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#4527A0",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <HomeIcon size={11} />
        Home Service · {formatTime(booking.start_time)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1E1916" }}>
        {customer?.full_name ?? "Customer"}
      </div>
      {address && (
        <div
          style={{
            fontSize: 12,
            color: "#5A4A6A",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MapPin size={11} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {address}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Completed banner ──────────────────────────────────────────────────────────

function AllDoneBanner() {
  return (
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
          All done for today!
        </div>
        <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
          All appointments completed. Great work!
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type StaffMobileHomeProps = {
  staff: StaffPortalStaff;
  bookings: StaffPortalBooking[];
  date: string;
};

export function StaffMobileHome({ staff, bookings }: StaffMobileHomeProps) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Next booking: first non-completed that starts >= now, or first non-completed overall
  const nextBooking =
    sorted.find((b) => {
      if (b.status === "completed" || b.status === "cancelled") return false;
      const [h, m] = b.start_time.split(":").map(Number);
      return (h ?? 0) * 60 + (m ?? 0) >= nowMinutes;
    }) ??
    sorted.find((b) => b.status !== "completed" && b.status !== "cancelled") ??
    null;

  // Home service bookings that are active or upcoming
  const activeHomeService = sorted.filter(
    (b) =>
      b.type === "home_service" &&
      b.status !== "completed" &&
      b.status !== "cancelled"
  );

  const allCompleted =
    bookings.length > 0 &&
    bookings.every((b) => b.status === "completed" || b.status === "cancelled");

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
        paddingBottom: 96, // room for fixed bottom nav
      }}
    >
      {/* Sticky top bar */}
      <TopBar staff={staff} />

      {/* Scrollable content */}
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
        <GreetingCard staff={staff} totalBookings={bookings.length} />

        {/* All done banner */}
        {allCompleted && <AllDoneBanner />}

        {/* Active home service alert */}
        {activeHomeService.length > 0 && activeHomeService[0] && (
          <HomeServiceBanner booking={activeHomeService[0]} />
        )}

        {/* Next action card */}
        {nextBooking && !allCompleted && (
          <NextActionCard booking={nextBooking} />
        )}

        {/* Today timeline */}
        <TodayTimeline bookings={sorted} nextBookingId={nextBooking?.id ?? null} />

        {/* Today overview */}
        {bookings.length > 0 && <TodayOverview bookings={bookings} />}

        {/* Quick links */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.5rem",
          }}
        >
          {[
            { label: "My Week", href: "/staff-portal/week", desc: "Weekly appointments" },
            { label: "My Schedule", href: "/staff-portal/schedule", desc: "Full schedule view" },
            { label: "Dispatch", href: "/staff-portal/dispatch", desc: "Home service ops" },
            { label: "My Stats", href: "/staff-portal/stats", desc: "Performance & hours" },
          ].map(({ label, href, desc }) => (
            <Link
              key={href}
              href={href}
              style={{
                textDecoration: "none",
                backgroundColor: "#fff",
                borderRadius: 12,
                border: "1px solid var(--cs-border-soft)",
                padding: "0.75rem 0.875rem",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                boxShadow: "var(--cs-shadow-xs)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>{label}</div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Fixed bottom nav */}
      <StaffMobileBottomNav />
    </div>
  );
}
