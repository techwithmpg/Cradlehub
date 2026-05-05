import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";

export function PaymentMethodBadge({ method }: { method: string }) {
  const label = PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: "0.6875rem",
        fontWeight: 500,
        backgroundColor: "var(--cs-surface-warm)",
        color: "var(--cs-text-muted)",
        border: "1px solid var(--cs-border)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
