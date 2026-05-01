"use client";

import { useEffect, useState } from "react";

type Slot = {
  staff_id: string;
  staff_name: string;
  staff_tier: string;
  slot_time: string;
  available: boolean;
};

type AvailableSlotsResponse = {
  slots?: Slot[];
  error?: string;
};

type TimeSlotGridProps = {
  branchId: string;
  serviceId: string;
  staffId?: string;
  date: string;
  onSelect: (slot: { staffId: string; staffName: string; time: string }) => void;
  selected?: { staffId: string; time: string } | null;
};

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":").map((value) => Number(value));
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const display = (h ?? 0) % 12 || 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function todayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TimeSlotGrid({
  branchId,
  serviceId,
  staffId,
  date,
  onSelect,
  selected,
}: TimeSlotGridProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId || !serviceId || !date) return;
    let cancelled = false;

    const kickoffTimer = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    }, 0);

    const params = new URLSearchParams({ branchId, serviceId, date });
    if (staffId) params.set("staffId", staffId);

    fetch(`/api/booking/available-slots?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as AvailableSlotsResponse;
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load slots");
        }
        if (cancelled) return;
        setSlots(data.slots ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not load slots. Please try again.";
        setError(message);
        setSlots([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(kickoffTimer);
    };
  }, [branchId, serviceId, staffId, date]);

  if (loading) {
    return (
      <div style={{ padding: "1rem", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        Loading available slots…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "0.75rem",
          backgroundColor: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 6,
          fontSize: "0.875rem",
          color: "#991B1B",
        }}
      >
        {error}
      </div>
    );
  }

  const availableSlots = slots.filter((slot) => slot.available);
  if (availableSlots.length === 0) {
    const isToday = date === todayYmd();
    return (
      <div
        style={{
          padding: "0.75rem",
          backgroundColor: "#FEFCE8",
          border: "1px solid #FEF08A",
          borderRadius: 6,
          fontSize: "0.875rem",
          color: "#713F12",
        }}
      >
        {isToday
          ? "No more available slots today. Please choose another date."
          : "No available slots for this date. Try another day or therapist."}
      </div>
    );
  }

  const byStaff = availableSlots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const current = acc[slot.staff_id] ?? [];
    current.push(slot);
    acc[slot.staff_id] = current;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {Object.values(byStaff).map((staffSlots) => {
        const staff = staffSlots[0];
        if (!staff) return null;

        return (
          <div key={staff.staff_id}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                marginBottom: "0.5rem",
              }}
            >
              {staff.staff_name}
              <span style={{ fontWeight: 400, marginLeft: 6 }}>· {staff.staff_tier}</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                gap: "0.375rem",
              }}
            >
              {staffSlots.map((slot) => {
                const isSelected = selected?.staffId === slot.staff_id && selected?.time === slot.slot_time;
                return (
                  <button
                    key={`${slot.staff_id}-${slot.slot_time}`}
                    type="button"
                    onClick={() =>
                      onSelect({
                        staffId: slot.staff_id,
                        staffName: slot.staff_name,
                        time: slot.slot_time,
                      })
                    }
                    style={{
                      padding: "6px 4px",
                      borderRadius: 6,
                      border: `1.5px solid ${isSelected ? "var(--cs-sand)" : "var(--cs-border)"}`,
                      backgroundColor: isSelected ? "var(--cs-sand-mist)" : "var(--cs-surface)",
                      color: isSelected ? "var(--cs-sand)" : "var(--cs-text)",
                      fontSize: "0.8125rem",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {formatDisplayTime(slot.slot_time)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

