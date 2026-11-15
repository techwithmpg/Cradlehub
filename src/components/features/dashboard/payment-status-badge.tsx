import type { PaymentStatus } from "@/lib/validations/booking";

type BadgeStyle = { bg: string; color: string; label: string };

const STYLES: Record<PaymentStatus, BadgeStyle> = {
  paid: { bg: "var(--cs-success-bg)", color: "var(--cs-success-text)", label: "Paid" },
  unpaid: { bg: "var(--cs-error-bg)", color: "var(--cs-error-text)", label: "Unpaid" },
  pending: { bg: "var(--cs-warning-bg)", color: "var(--cs-warning-text)", label: "Pending" },
  refunded: { bg: "var(--cs-info-bg)", color: "var(--cs-info-text)", label: "Refunded" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = STYLES[status as PaymentStatus] ?? STYLES.unpaid;
  return (
    <span
      className="cs-badge inline-flex items-center whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}
