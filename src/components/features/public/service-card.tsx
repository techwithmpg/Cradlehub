import Link from "next/link";

type ServiceCardProps = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  branchId?: string;
};

function formatCurrencyLocal(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function ServiceCard({
  id,
  name,
  description,
  durationMinutes,
  price,
  branchId,
}: ServiceCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--ch-surface)",
        border: "1px solid var(--ch-border)",
        borderRadius: 12,
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--ch-text)" }}>{name}</div>

      {description && (
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--ch-text-muted)",
            lineHeight: 1.6,
            flex: 1,
          }}
        >
          {description}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--ch-border)",
        }}
      >
        <div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--ch-text)" }}>
            {formatCurrencyLocal(price)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>{durationMinutes} minutes</div>
        </div>
        <Link
          href={branchId ? `/book/${branchId}/${id}` : "/book"}
          style={{
            padding: "7px 16px",
            borderRadius: 7,
            backgroundColor: "var(--ch-accent)",
            color: "var(--ch-surface)",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Book
        </Link>
      </div>
    </div>
  );
}
