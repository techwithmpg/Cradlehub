import { CheckCircle, XCircle, Clock, Star } from "lucide-react";
import { DispatchStatsCards } from "./dispatch-stats-cards";
import type { RealDispatchItem, DispatchStats } from "@/lib/queries/dispatch-queries";

interface DispatchCompletedTabProps {
  items: RealDispatchItem[];
  stats: DispatchStats;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ color: "#F59E0B", fontWeight: 700, fontSize: 13 }}>
      {rating} ★
    </span>
  );
}

function fmtCompletedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function DispatchCompletedTab({ items, stats }: DispatchCompletedTabProps) {
  const completedStats = [
    { label: "Completed Today", value: stats.completedToday, icon: <CheckCircle size={14} />, accentColor: "#16A34A" },
    { label: "Cancelled Today", value: stats.cancelledToday, icon: <XCircle size={14} />,     accentColor: "#B91C1C" },
    { label: "On-Time Rate",    value: "—",                  icon: <Clock size={14} />,        accentColor: "#2563EB" },
    { label: "Avg. Rating",     value: "—",                  icon: <Star size={14} />,         accentColor: "#D97706" },
  ];

  return (
    <div>
      <DispatchStatsCards stats={completedStats} />

      {items.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--cs-text-subtle)", fontSize: 13 }}>
          No completed home-service dispatches yet.
        </div>
      ) : (
        <div
          style={{
            background:   "var(--cs-surface)",
            border:       "1px solid var(--cs-border-soft)",
            borderRadius: "var(--cs-r-md)",
            overflow:     "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Dispatch #", "Customer", "Service", "Completed At", "Driver", "Therapist", "Rating"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding:       "0.625rem 0.875rem",
                      textAlign:     "left",
                      fontSize:      10.5,
                      fontWeight:    500,
                      color:         "var(--cs-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      borderBottom:  "1.5px solid var(--cs-border-soft)",
                      whiteSpace:    "nowrap",
                      background:    "var(--cs-surface-warm, #FAF8F5)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--cs-border-soft)" }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: "#16A34A", fontSize: 13 }}>{item.number}</span>
                  </td>
                  <td style={tdStyle}>{item.customerName}</td>
                  <td style={tdStyle}>{item.serviceName}</td>
                  <td style={tdStyle}>{fmtCompletedAt(item.completedAt)}</td>
                  <td style={tdStyle}>{item.driverName ?? "—"}</td>
                  <td style={tdStyle}>
                    {item.therapistName ?? <span style={{ color: "var(--cs-text-subtle)" }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    {item.rating !== null ? <StarRating rating={item.rating} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding:    "0.625rem 0.875rem",
  fontSize:   13,
  color:      "var(--cs-text)",
  whiteSpace: "nowrap",
};
