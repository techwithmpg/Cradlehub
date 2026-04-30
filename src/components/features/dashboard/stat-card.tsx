type StatCardProps = {
  label:   string;
  value:   string | number;
  sub?:    string;
  trend?:  "up" | "down" | "flat";
  accent?: boolean;
};

export function StatCard({ label, value, sub, trend, accent }: StatCardProps) {
  return (
    <div className="cs-kpi" style={{
      borderLeft: accent ? "3px solid var(--cs-sand)" : "3px solid transparent",
    }}>
      <div style={{
        fontSize:      "0.6875rem",
        fontWeight:    600,
        color:         "var(--cs-text-muted)",
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        marginBottom:  "0.5rem",
      }}>
        {label}
      </div>
      <div style={{
        fontSize:   "1.875rem",
        fontWeight: 700,
        color:      "var(--cs-text)",
        lineHeight: 1,
        fontFamily: "var(--font-display)",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize:  "0.75rem",
          color:     trend === "up"   ? "var(--cs-sage)"
                   : trend === "down" ? "var(--cs-error)"
                   :                   "var(--cs-text-muted)",
          marginTop: "0.375rem",
        }}>
          {trend === "up" && "↑ "}{trend === "down" && "↓ "}{sub}
        </div>
      )}
    </div>
  );
}
