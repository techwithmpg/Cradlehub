const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  confirmed:   { bg: "#EDF3F8", color: "#4A6B82", label: "Confirmed"   },
  in_progress: { bg: "#F5EDE3", color: "#7A5233", label: "In Progress" },
  completed:   { bg: "#EAF0EA", color: "#4A6B52", label: "Completed"   },
  cancelled:   { bg: "#F5F0EA", color: "#7A6A5A", label: "Cancelled"   },
  no_show:     { bg: "#FAF0EE", color: "#8A4A3A", label: "No Show"     },
  pending:     { bg: "#FAF0E4", color: "#7A5A34", label: "Pending"     },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS["pending"]!;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px",
      borderRadius: "var(--cs-radius-pill)",
      fontSize: "0.6875rem", fontWeight: 600,
      backgroundColor: s.bg, color: s.color, whiteSpace: "nowrap" as const,
    }}>
      {s.label}
    </span>
  );
}
