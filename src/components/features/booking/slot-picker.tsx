"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Slot = {
  staff_id: string;
  staff_name: string;
  staff_tier: string;
  slot_time: string;
  available: boolean;
};

type SlotResponse = {
  slots?: Slot[];
};

type SlotPickerProps = {
  branchId: string;
  serviceId: string;
  confirmUrl: string;
};

type StaffMode = "any" | string;

const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const display = (h ?? 0) % 12 || 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getMaxDateStr(): string {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  return maxDate.toISOString().split("T")[0]!;
}

export function SlotPicker({ branchId, serviceId, confirmUrl }: SlotPickerProps) {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [staffMode, setStaffMode] = useState<StaffMode>("any");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ branchId, serviceId, date });
    if (staffMode !== "any") {
      params.set("staffId", staffMode);
    }

    fetch(`/api/booking/available-slots?${params}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load slots");
        }
        return (await response.json()) as SlotResponse;
      })
      .then((data) => {
        setSlots(data.slots ?? []);
      })
      .catch(() => {
        setError("Could not load available times. Please try again.");
        setSlots([]);
      })
      .finally(() => setLoading(false));
  }, [branchId, serviceId, date, staffMode]);

  const allStaff = useMemo(() => {
    const map = new Map<string, { id: string; name: string; tier: string }>();
    slots.forEach((slot) => {
      if (!map.has(slot.staff_id)) {
        map.set(slot.staff_id, {
          id: slot.staff_id,
          name: slot.staff_name,
          tier: slot.staff_tier,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const tierDelta = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
      if (tierDelta !== 0) return tierDelta;
      return a.name.localeCompare(b.name);
    });
  }, [slots]);

  const displayed = useMemo(() => {
    if (staffMode === "any") {
      return slots.filter((slot) => slot.available);
    }
    return slots.filter((slot) => slot.staff_id === staffMode && slot.available);
  }, [slots, staffMode]);

  const byStaff = useMemo(() => {
    const grouped: Record<string, Slot[]> = {};
    displayed.forEach((slot) => {
      const existing = grouped[slot.staff_id];
      if (existing) {
        existing.push(slot);
      } else {
        grouped[slot.staff_id] = [slot];
      }
    });
    return grouped;
  }, [displayed]);

  function selectSlot(slot: Slot) {
    const [path, queryString] = confirmUrl.split("?");
    const params = new URLSearchParams(queryString ?? "");
    params.set("date", date);
    params.set("time", slot.slot_time);
    if (staffMode === "any") {
      params.delete("staffId");
    } else {
      params.set("staffId", slot.staff_id);
    }
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <div>
      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ch-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}
        >
          Select Date
        </div>
        <input
          type="date"
          value={date}
          min={todayStr()}
          max={getMaxDateStr()}
          onChange={(event) => setDate(event.target.value)}
          style={{
            height: 40,
            borderRadius: 8,
            border: "1px solid var(--ch-border)",
            padding: "0 0.875rem",
            fontSize: "0.9375rem",
            color: "var(--ch-text)",
            backgroundColor: "var(--ch-surface)",
            width: "100%",
            maxWidth: 200,
          }}
        />
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ch-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}
        >
          Therapist
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setStaffMode("any")}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              border: `1.5px solid ${
                staffMode === "any" ? "var(--ch-accent)" : "var(--ch-border)"
              }`,
              backgroundColor: staffMode === "any" ? "var(--ch-accent-light)" : "var(--ch-surface)",
              color: staffMode === "any" ? "var(--ch-accent)" : "var(--ch-text-muted)",
              fontSize: "0.875rem",
              fontWeight: staffMode === "any" ? 600 : 400,
              cursor: "pointer",
            }}
          >
            Any available
          </button>

          {allStaff.map((staffMember) => (
            <button
              key={staffMember.id}
              type="button"
              onClick={() => setStaffMode(staffMember.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: `1.5px solid ${
                  staffMode === staffMember.id ? "var(--ch-accent)" : "var(--ch-border)"
                }`,
                backgroundColor:
                  staffMode === staffMember.id ? "var(--ch-accent-light)" : "var(--ch-surface)",
                color: staffMode === staffMember.id ? "var(--ch-accent)" : "var(--ch-text-muted)",
                fontSize: "0.875rem",
                fontWeight: staffMode === staffMember.id ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {staffMember.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ch-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}
        >
          Available Times
        </div>

        {loading ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              color: "var(--ch-text-muted)",
              fontSize: "0.875rem",
            }}
          >
            Finding available slots...
          </div>
        ) : error ? (
          <div
            style={{
              padding: "0.875rem",
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 8,
              fontSize: "0.875rem",
              color: "var(--ch-crm-text)",
            }}
          >
            {error}
          </div>
        ) : Object.keys(byStaff).length === 0 ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "var(--ch-text)",
                marginBottom: 6,
              }}
            >
              No available times on this date
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--ch-text-muted)" }}>
              Try selecting a different date or therapist.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {staffMode === "any" ? (
              (() => {
                const uniqueTimes = Array.from(new Map(displayed.map((slot) => [slot.slot_time, slot])).values());
                return (
                  <div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)", marginBottom: "0.5rem" }}>
                      Best available therapist assigned automatically
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                        gap: "0.5rem",
                      }}
                    >
                      {uniqueTimes.map((slot) => (
                        <button
                          key={slot.slot_time}
                          type="button"
                          onClick={() => selectSlot(slot)}
                          style={{
                            padding: "10px 8px",
                            borderRadius: 8,
                            border: "1.5px solid var(--ch-border)",
                            backgroundColor: "var(--ch-surface)",
                            color: "var(--ch-text)",
                            fontSize: "0.9375rem",
                            fontWeight: 500,
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.borderColor = "var(--ch-accent)";
                            event.currentTarget.style.backgroundColor = "var(--ch-accent-light)";
                            event.currentTarget.style.color = "var(--ch-accent)";
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.borderColor = "var(--ch-border)";
                            event.currentTarget.style.backgroundColor = "var(--ch-surface)";
                            event.currentTarget.style.color = "var(--ch-text)";
                          }}
                        >
                          {formatDisplayTime(slot.slot_time)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              Object.values(byStaff).map((staffSlots) => {
                const first = staffSlots[0]!;
                return (
                  <div key={first.staff_id}>
                    <div style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)", marginBottom: "0.5rem" }}>
                      {first.staff_name} · {first.staff_tier}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                        gap: "0.5rem",
                      }}
                    >
                      {staffSlots.map((slot) => (
                        <button
                          key={slot.slot_time}
                          type="button"
                          onClick={() => selectSlot(slot)}
                          style={{
                            padding: "10px 8px",
                            borderRadius: 8,
                            border: "1.5px solid var(--ch-border)",
                            backgroundColor: "var(--ch-surface)",
                            color: "var(--ch-text)",
                            fontSize: "0.9375rem",
                            fontWeight: 500,
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.borderColor = "var(--ch-accent)";
                            event.currentTarget.style.backgroundColor = "var(--ch-accent-light)";
                            event.currentTarget.style.color = "var(--ch-accent)";
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.borderColor = "var(--ch-border)";
                            event.currentTarget.style.backgroundColor = "var(--ch-surface)";
                            event.currentTarget.style.color = "var(--ch-text)";
                          }}
                        >
                          {formatDisplayTime(slot.slot_time)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
