import type { PaymentStatus } from "@/lib/validations/booking";

type BadgeStyle = { bg: string; color: string; label: string };

const STYLES: Record<PaymentStatus, BadgeStyle> = {
  paid:     { bg: "#D1FAE5", color: "#065F46", label: "Paid" },
  unpaid:   { bg: "#FEE2E2", color: "#991B1B", label: "Unpaid" },
  pending:  { bg: "#FEF3C7", color: "#92400E", label: "Pending" },
  refunded: { bg: "#E0E7FF", color: "#3730A3", label: "Refunded" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = STYLES[status as PaymentStatus] ?? STYLES.unpaid;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
