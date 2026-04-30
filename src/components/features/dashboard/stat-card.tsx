type StatCardProps = {
  label:        string;
  value:        string | number;
  sub?:         string;
  trend?:       "up" | "down" | "flat";
  accent?:      boolean;
  accentColor?: string;
  icon?:        React.ReactNode;
};

export function StatCard({ label, value, sub, trend, accent, accentColor, icon }: StatCardProps) {
  const accentStyle = accentColor ?? "var(--cs-sand)";
  return (
    <div
      className="cs-metric"
      style={{
        borderTop:    accent ? `3px solid ${accentStyle}` : "1px solid var(--cs-border-soft)",
        borderRadius: accent ? "0 0 var(--cs-r-md) var(--cs-r-md)" : "var(--cs-r-md)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.625rem" }}>
        <div style={{
          fontSize:      10.5,
          fontWeight:    500,
          color:         "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}>
          {label}
        </div>
        {icon && (
          <div style={{
            width:          28,
            height:         28,
            borderRadius:   "var(--cs-r-xs)",
            background:     `${accentStyle}15`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            color:          accentStyle,
            fontSize:       14,
            flexShrink:     0,
          }}>
            {icon}
          </div>
        )}
      </div>

      <div style={{
        fontSize:           "1.75rem",
        fontWeight:         600,
        color:              "var(--cs-text)",
        lineHeight:         1,
        letterSpacing:      "-0.02em",
        fontVariantNumeric: "tabular-nums",
        fontFamily:         "var(--cs-font-body)",
      }}>
        {value}
      </div>

      {sub && (
        <div style={{
          fontSize:   11.5,
          color:      trend === "up"   ? "var(--cs-success)"
                    : trend === "down" ? "var(--cs-error)"
                    :                   "var(--cs-text-subtle)",
          marginTop:  "0.375rem",
          display:    "flex",
          alignItems: "center",
          gap:        3,
        }}>
          {trend === "up"   && <span>↑</span>}
          {trend === "down" && <span>↓</span>}
          {sub}
        </div>
      )}
    </div>
  );
}
