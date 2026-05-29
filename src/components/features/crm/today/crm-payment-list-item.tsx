"use client";

import { CrmLoadingButton } from "./crm-loading-button";

export type PaymentListItemData = {
  id: string;
  customer_name: string | null;
  service_name: string | null;
  amount_paid?: number | null;
  price_paid?: number | null;
  payment_status?: string | null;
  payment_method?: string | null;
  status: string;
  start_time: string;
};

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  pay_on_site: "Pay on Site",
  other: "Other",
};

export function CrmPaymentListItem({
  payment,
  onConfirm,
  onReview,
}: {
  payment: PaymentListItemData;
  onConfirm?: () => Promise<void>;
  onReview?: () => void;
}) {
  const outstanding = (payment.price_paid ?? 0) - (payment.amount_paid ?? 0);
  const methodLabel = METHOD_LABELS[payment.payment_method ?? "pay_on_site"] ?? "Unknown";

  return (
    <div
      className="cs-card"
      style={{
        padding: "0.875rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
        transition: "box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-sm)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-xs)";
      }}
    >
      <div style={{ minWidth: 48, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
          {formatTime(payment.start_time)}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {payment.customer_name ?? "—"}
        </div>
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {payment.service_name ?? "Service"} · {methodLabel}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-error)" }}>
          ₱{outstanding.toLocaleString()}
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
          {payment.amount_paid ? `Paid ₱${payment.amount_paid.toLocaleString()}` : "Unpaid"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {onReview && (
          <CrmLoadingButton
            label="Review"
            variant="secondary"
            onClick={onReview}
          />
        )}
        {onConfirm && (
          <CrmLoadingButton
            label="Confirm"
            loadingLabel="Confirming..."
            variant="primary"
            onClick={onConfirm}
          />
        )}
      </div>
    </div>
  );
}
