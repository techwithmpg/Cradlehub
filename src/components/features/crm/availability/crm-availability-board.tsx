"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CrmAvailabilityStaffRow, LiveStatus } from "@/lib/queries/crm-availability";
import { checkInStaffForShiftAction, checkOutStaffForShiftAction } from "@/lib/actions/staff-checkins";
import { MVP_CHECKIN_PAUSED } from "@/lib/config/mvp-flags";
import { formatTime12h } from "@/lib/utils/time-format";

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name, bg = "var(--cs-border)" }: { name: string; bg?: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: "50%",
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#fff",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<LiveStatus, { label: string; bg: string; color: string }> = {
  available_now:  { label: "Available",    bg: "rgba(39,174,96,0.13)",   color: "#1d7a42" },
  busy_now:       { label: "Busy",         bg: "rgba(41,128,185,0.12)",  color: "#1a5f8e" },
  not_checked_in: { label: "Not In",       bg: "rgba(230,126,34,0.12)",  color: "#b35b0a" },
  checked_out:    { label: "Checked Out",  bg: "rgba(120,120,120,0.10)", color: "var(--cs-text-muted)" },
  off_today:      { label: "Off Today",    bg: "rgba(120,120,120,0.10)", color: "var(--cs-text-muted)" },
  no_schedule:    { label: "No Schedule",  bg: "rgba(230,126,34,0.12)",  color: "#b35b0a" },
};

function StatusChip({ status }: { status: LiveStatus }) {
  const m = STATUS_META[status] ?? { label: status, bg: "rgba(0,0,0,0.06)", color: "var(--cs-text-muted)" };
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10,
        background: m.bg, color: m.color, whiteSpace: "nowrap", letterSpacing: "0.02em",
      }}
    >
      {m.label}
    </span>
  );
}

// ── Avatar colors by liveStatus ───────────────────────────────────────────────

const AVATAR_BG: Record<LiveStatus, string> = {
  available_now:  "#2d9e63",
  busy_now:       "#2471a3",
  not_checked_in: "#c97a18",
  checked_out:    "#95a5a6",
  off_today:      "#95a5a6",
  no_schedule:    "#e67e22",
};

// ── Check-in / out action ─────────────────────────────────────────────────────

function CheckinAction({
  staff,
  shiftDate,
}: {
  staff: CrmAvailabilityStaffRow;
  shiftDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const shiftType = (staff.shifts[0]?.shift_type ?? "single") as "single" | "opening" | "closing";

  // Check-in buttons are hidden while MVP_CHECKIN_PAUSED.
  // Hooks must remain above this guard to satisfy Rules of Hooks.
  if (MVP_CHECKIN_PAUSED) return null;

  if (staff.presenceStatus === "not_checked_in") {
    return (
      <div>
        <button
          type="button"
          aria-label={`Check in ${staff.staff_name}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await checkInStaffForShiftAction({
                staffId: staff.staff_id,
                shiftDate,
                shiftType,
              });
              if (r.ok) router.refresh();
              else setError(r.message);
            })
          }
          style={{
            padding: "2px 9px", fontSize: 10, fontWeight: 600,
            background: "#2d9e63", color: "#fff",
            border: "none", borderRadius: 5,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "…" : "Check in"}
        </button>
        {error && (
          <span style={{ display: "block", fontSize: 9, color: "#c0392b", marginTop: 2, lineHeight: 1.3 }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  if (staff.presenceStatus === "checked_in") {
    return (
      <div>
        <button
          type="button"
          aria-label={`Check out ${staff.staff_name}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await checkOutStaffForShiftAction({
                staffId: staff.staff_id,
                shiftDate,
                shiftType,
              });
              if (r.ok) router.refresh();
              else setError(r.message);
            })
          }
          style={{
            padding: "2px 9px", fontSize: 10, fontWeight: 500,
            background: "transparent", color: "var(--cs-text-muted)",
            border: "1px solid var(--cs-border-soft)", borderRadius: 5,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "…" : "Check out"}
        </button>
        {error && (
          <span style={{ display: "block", fontSize: 9, color: "#c0392b", marginTop: 2, lineHeight: 1.3 }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return null;
}

// ── Compact staff row (72–84 px) ──────────────────────────────────────────────

type CompactStaffRowProps = {
  staff: CrmAvailabilityStaffRow;
  shiftDate: string;
  showAction?: boolean;
};

function CompactStaffRow({ staff, shiftDate, showAction = true }: CompactStaffRowProps) {
  const roleLabel = (staff.staff_type || staff.system_role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const timeLabel =
    staff.work_start && staff.work_end
      ? `${formatTime12h(staff.work_start)} – ${formatTime12h(staff.work_end)}`
      : null;

  const bookingService =
    staff.liveStatus === "busy_now" && staff.active_booking
      ? staff.active_booking.service
      : null;

  const avatarBg = AVATAR_BG[staff.liveStatus] ?? "var(--cs-border)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        borderBottom: "1px solid var(--cs-border-soft)",
        minHeight: 72,
        background: "var(--cs-surface)",
      }}
    >
      {/* Avatar */}
      <Avatar name={staff.staff_name} bg={avatarBg} />

      {/* Name / role / time */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12, fontWeight: 600, color: "var(--cs-text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: 1.3,
          }}
        >
          {staff.staff_name}
        </div>
        <div
          style={{
            fontSize: 10, color: "var(--cs-text-muted)", marginTop: 1,
            textTransform: "capitalize", lineHeight: 1.3,
          }}
        >
          {roleLabel}
        </div>
        {timeLabel && (
          <div style={{ fontSize: 10, color: "var(--cs-text-subtle)", marginTop: 1, lineHeight: 1.3 }}>
            {timeLabel}
          </div>
        )}
        {bookingService && (
          <div
            style={{
              fontSize: 10, color: "#1a5f8e", marginTop: 1, lineHeight: 1.3,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {bookingService}
          </div>
        )}
      </div>

      {/* Status + action */}
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          gap: 4, flexShrink: 0,
        }}
      >
        <StatusChip status={staff.liveStatus} />
        {showAction && <CheckinAction staff={staff} shiftDate={shiftDate} />}
      </div>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

function ColumnHeader({
  title,
  count,
  countColor,
  helper,
}: {
  title: string;
  count: number;
  countColor: string;
  helper?: string;
}) {
  return (
    <div
      style={{
        padding: "9px 12px",
        borderBottom: "1px solid var(--cs-border-soft)",
        background: "var(--cs-surface-warm)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)" }}>{title}</span>
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            color: countColor,
            background: `${countColor}1a`,
            padding: "1px 7px", borderRadius: 10, lineHeight: 1.5,
          }}
        >
          {count}
        </span>
      </div>
      {helper && (
        <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 2 }}>{helper}</div>
      )}
    </div>
  );
}

// ── Empty column state ────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 12px",
        textAlign: "center",
        fontSize: 11,
        color: "var(--cs-text-muted)",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

// ── Needs Attention — grouped sections ────────────────────────────────────────

type IssueGroup = {
  id: string;
  label: string;
  count: number;
  members: CrmAvailabilityStaffRow[];
};

function buildGroups(staff: CrmAvailabilityStaffRow[]): IssueGroup[] {
  const noSchedule = staff.filter((s) => s.scheduleStatus === "no_schedule");
  const other      = staff.filter((s) => s.scheduleStatus !== "no_schedule");

  const groups: IssueGroup[] = [];
  if (noSchedule.length > 0)
    groups.push({ id: "no_schedule", label: "No Schedule Set", count: noSchedule.length, members: noSchedule });
  if (other.length > 0)
    groups.push({ id: "review",     label: "Needs Review",    count: other.length,      members: other });
  return groups;
}

const MAX_PER_GROUP = 4;

function NeedsAttentionContent({
  staff,
  shiftDate,
}: {
  staff: CrmAvailabilityStaffRow[];
  shiftDate: string;
}) {
  if (staff.length === 0) {
    return <EmptyState message={"✓ Nothing needs\nattention right now"} />;
  }

  const groups = buildGroups(staff);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {groups.map((group) => (
        <div key={group.id}>
          {/* Group header */}
          <div
            style={{
              padding: "5px 10px",
              background: "rgba(230,126,34,0.07)",
              borderBottom: "1px solid var(--cs-border-soft)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 10, color: "#b35b0a" }}>⚠</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text-secondary)", flex: 1 }}>
              {group.label}
            </span>
            <span
              style={{
                fontSize: 10, fontWeight: 700, color: "#b35b0a",
                background: "rgba(230,126,34,0.15)", padding: "0 5px", borderRadius: 8,
              }}
            >
              {group.count}
            </span>
          </div>

          {/* Top rows */}
          {group.members.slice(0, MAX_PER_GROUP).map((s) => (
            <CompactStaffRow key={s.staff_id} staff={s} shiftDate={shiftDate} showAction={false} />
          ))}

          {/* Overflow count */}
          {group.count > MAX_PER_GROUP && (
            <div
              style={{
                padding: "5px 10px",
                fontSize: 10, color: "var(--cs-text-muted)", textAlign: "center",
                borderBottom: "1px solid var(--cs-border-soft)",
              }}
            >
              +{group.count - MAX_PER_GROUP} more — see Schedule Issues tab
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────

const BOARD_HEIGHT = 380; // px — consistent column height with internal scroll

type CrmAvailabilityBoardProps = {
  staff: CrmAvailabilityStaffRow[];
  shiftDate: string;
  /** Not used — kept for compatibility with old call sites. */
  maxPerColumn?: number;
};

export function CrmAvailabilityBoard({ staff, shiftDate }: CrmAvailabilityBoardProps) {
  // When MVP_CHECKIN_PAUSED, all scheduled staff are synthetically checked-in, so the
  // "Not Checked In" column is always empty. Show "Off Today" instead.
  const col1       = MVP_CHECKIN_PAUSED
    ? staff.filter((s) => s.scheduleStatus === "off_today")
    : staff.filter((s) => s.liveStatus === "not_checked_in");
  const available  = staff.filter((s) => s.liveStatus === "available_now");
  const busy       = staff.filter((s) => s.liveStatus === "busy_now");
  const attention  = staff.filter((s) => s.needsAttention);

  const MAX_ROWS_COL1 = 12;

  const colStyle: React.CSSProperties = {
    border: "1px solid var(--cs-border-soft)",
    borderRadius: "var(--cs-r-md, 10px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    height: BOARD_HEIGHT,
    background: "var(--cs-surface)",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.75rem",
      }}
    >
      {/* Column 1 — Off Today (MVP) or Not Checked In */}
      <div style={colStyle}>
        <ColumnHeader
          title={MVP_CHECKIN_PAUSED ? "Off Today" : "Not Checked In"}
          count={col1.length}
          countColor={MVP_CHECKIN_PAUSED ? "#95a5a6" : "#c97a18"}
          helper={MVP_CHECKIN_PAUSED ? "Day-off or no schedule today" : "Scheduled but not present"}
        />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {col1.length === 0 ? (
            <EmptyState message={MVP_CHECKIN_PAUSED ? "No staff off today" : "✓ All scheduled\nstaff are checked in"} />
          ) : (
            <>
              {col1.slice(0, MAX_ROWS_COL1).map((s) => (
                <CompactStaffRow key={s.staff_id} staff={s} shiftDate={shiftDate} showAction={!MVP_CHECKIN_PAUSED} />
              ))}
              {col1.length > MAX_ROWS_COL1 && (
                <div
                  style={{
                    padding: "6px 10px",
                    fontSize: 10, color: "var(--cs-text-muted)", textAlign: "center",
                    borderTop: "1px solid var(--cs-border-soft)",
                  }}
                >
                  +{col1.length - MAX_ROWS_COL1} more — see Staff List
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Column 2 — Available Now */}
      <div style={colStyle}>
        <ColumnHeader
          title="Available Now"
          count={available.length}
          countColor="#2d9e63"
          helper={MVP_CHECKIN_PAUSED ? "Scheduled and free" : "Checked in and free"}
        />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {available.length === 0 ? (
            <EmptyState message="No staff available right now" />
          ) : (
            available.map((s) => (
              <CompactStaffRow key={s.staff_id} staff={s} shiftDate={shiftDate} showAction />
            ))
          )}
        </div>
      </div>

      {/* Column 3 — Busy / Assigned */}
      <div style={colStyle}>
        <ColumnHeader
          title="Busy / Assigned"
          count={busy.length}
          countColor="#2471a3"
          helper="In session or assigned"
        />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {busy.length === 0 ? (
            <EmptyState message="No active sessions" />
          ) : (
            busy.map((s) => (
              <CompactStaffRow key={s.staff_id} staff={s} shiftDate={shiftDate} showAction={false} />
            ))
          )}
        </div>
      </div>

      {/* Column 4 — Needs Attention */}
      <div style={colStyle}>
        <ColumnHeader
          title="Needs Attention"
          count={attention.length}
          countColor="#c97a18"
          helper="Setup or schedule issues"
        />
        <NeedsAttentionContent staff={attention} shiftDate={shiftDate} />
      </div>
    </div>
  );
}
