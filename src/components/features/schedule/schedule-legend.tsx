"use client";

const LEGEND_ITEMS = [
  { label: "Booking", color: "#E8F5E9", border: "#4A7C59" },
  { label: "Break", color: "#EFF6FF", border: "#93C5FD" },
  { label: "Travel", color: "#FFF7ED", border: "#FDBA74" },
  { label: "Blocked", color: "#F0EDE8", border: "#BFB4AA", pattern: true },
  { label: "Off Duty", color: "rgba(200,190,180,0.28)", border: "transparent" },
  { label: "Conflict", color: "#FEF2F2", border: "#EF4444" },
];

export function ScheduleLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Legend
      </span>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              backgroundColor: item.color,
              border: item.border !== "transparent" ? `1.5px solid ${item.border}` : "none",
              backgroundImage: item.pattern
                ? "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(180,170,155,0.25) 3px, rgba(180,170,155,0.25) 6px)"
                : undefined,
            }}
          />
          <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
