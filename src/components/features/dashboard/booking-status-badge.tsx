const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: "#EFF6FF", color: "#1D4ED8", label: "Confirmed" },
  in_progress: { bg: "#F5F3FF", color: "#6D28D9", label: "In Progress" },
  completed: { bg: "#F0FDF4", color: "#15803D", label: "Completed" },
  cancelled: { bg: "#F9FAFB", color: "#6B7280", label: "Cancelled" },
  no_show: { bg: "#FFF7ED", color: "#C2410C", label: "No Show" },
  pending: { bg: "#FEFCE8", color: "#A16207", label: "Pending" },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = (STATUS_STYLES[status] ?? STATUS_STYLES.pending)!;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: "0.75rem",
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
