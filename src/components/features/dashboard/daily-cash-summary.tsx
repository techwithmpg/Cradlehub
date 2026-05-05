import { formatCurrency } from "@/lib/utils";

type ByMethod = {
  cash:        number;
  gcash:       number;
  maya:        number;
  card:        number;
  pay_on_site: number;
  other:       number;
};

export type DailyCashSummaryData = {
  total_expected:  number;
  total_collected: number;
  total_unpaid:    number;
  paid_count:      number;
  unpaid_count:    number;
  total_count:     number;
  by_method:       ByMethod;
};

type Props = {
  data:  DailyCashSummaryData;
  label: string;
};

const METHOD_ITEMS: { key: keyof ByMethod; label: string; color: string }[] = [
  { key: "cash",        label: "Cash",         color: "#059669" },
  { key: "gcash",       label: "GCash",        color: "#0EA5E9" },
  { key: "maya",        label: "Maya",         color: "#8B5CF6" },
  { key: "card",        label: "Card",         color: "#F59E0B" },
  { key: "pay_on_site", label: "Pay on Site",  color: "#94A3B8" },
  { key: "other",       label: "Other",        color: "#6B7280" },
];

export function DailyCashSummary({ data, label }: Props) {
  const hasCollections = data.total_collected > 0;
  const collectionRate = data.total_expected > 0
    ? Math.round((data.total_collected / data.total_expected) * 100)
    : 0;

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1rem 1.25rem",
        marginBottom: "1.25rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.875rem" }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Cash Summary
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginTop: 2 }}>{label}</div>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
          {data.total_count} booking{data.total_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "0.875rem" }}>
        <KpiCell
          label="Expected"
          value={formatCurrency(data.total_expected)}
          sub={`${data.total_count} active`}
          color="var(--cs-text)"
        />
        <KpiCell
          label="Collected"
          value={formatCurrency(data.total_collected)}
          sub={`${data.paid_count} paid · ${collectionRate}%`}
          color="#059669"
          highlight
        />
        <KpiCell
          label="Outstanding"
          value={formatCurrency(data.total_unpaid)}
          sub={`${data.unpaid_count} unpaid`}
          color={data.total_unpaid > 0 ? "#DC2626" : "#059669"}
        />
      </div>

      {/* Method breakdown */}
      {hasCollections && (
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
            By Method
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {METHOD_ITEMS.filter((m) => data.by_method[m.key] > 0).map((m) => (
              <div
                key={m.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 6,
                  backgroundColor: "var(--cs-surface-warm)",
                  border: "1px solid var(--cs-border)",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: m.color, flexShrink: 0 }} />
                <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>{m.label}</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>
                  {formatCurrency(data.by_method[m.key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasCollections && data.total_count > 0 && (
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
          No payments recorded yet for this period.
        </div>
      )}
    </div>
  );
}

function KpiCell({
  label, value, sub, color, highlight,
}: {
  label:     string;
  value:     string;
  sub:       string;
  color:     string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "0.625rem",
        borderRadius: 8,
        backgroundColor: highlight ? "rgba(5,150,105,0.06)" : "var(--cs-surface-warm)",
        border: highlight ? "1px solid rgba(5,150,105,0.2)" : "1px solid var(--cs-border)",
      }}
    >
      <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "1rem", fontWeight: 700, color, fontFamily: "var(--font-playfair)" }}>{value}</div>
      <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
