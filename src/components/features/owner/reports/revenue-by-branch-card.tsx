"use client";

import { formatCurrency } from "@/lib/utils";
import { RevenueByBranchData, calculateRevenueShare } from "@/lib/owner/reports";

interface RevenueByBranchCardProps {
  data: RevenueByBranchData[];
}

export function RevenueByBranchCard({ data }: RevenueByBranchCardProps) {
  const dataWithShare = calculateRevenueShare(data);

  return (
    <div className="cs-card" style={{ padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "1.5rem",
        }}
      >
        <span style={{ fontSize: 18 }}>🏢</span>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
          }}
        >
          Revenue by Branch
        </div>
      </div>

      {data.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          No branch data for this period
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {dataWithShare.map((item) => (
            <div key={item.name}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  marginBottom: "0.5rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--cs-text)",
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {item.count} bookings
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "var(--cs-sand)",
                    }}
                  >
                    {formatCurrency(item.revenue)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {item.share}% share
                  </div>
                </div>
              </div>
              <div
                style={{
                  height: 8,
                  backgroundColor: "var(--cs-border-soft)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${item.share}%`,
                    backgroundColor: "var(--cs-sand)",
                    borderRadius: 4,
                    transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
