"use client";

import { formatCurrency } from "@/lib/utils";
import { StaffProductivityData } from "@/lib/owner/reports";
import { Trophy, User } from "lucide-react";

interface StaffProductivityCardProps {
  data: StaffProductivityData[];
}

export function StaffProductivityCard({ data }: StaffProductivityCardProps) {
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
        <span style={{ fontSize: 18 }}>👩‍⚕️</span>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
          }}
        >
          Staff Productivity
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
          No staff data for this period
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {data.map((staff, index) => {
            const isTop = index === 0;
            return (
              <div
                key={staff.staffId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem",
                  backgroundColor: isTop ? "rgba(200, 169, 107, 0.05)" : "var(--cs-surface-warm)",
                  border: "1px solid",
                  borderColor: isTop ? "rgba(200, 169, 107, 0.2)" : "var(--cs-border-soft)",
                  borderRadius: "var(--cs-r-md)",
                  transition: "var(--cs-trans)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: isTop ? "var(--cs-sand)" : "var(--cs-border-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isTop ? "white" : "var(--cs-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {isTop ? <Trophy size={16} /> : <User size={16} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--cs-text)",
                      }}
                    >
                      {staff.name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: "var(--cs-r-pill)",
                        backgroundColor: "var(--cs-sand-mist)",
                        color: "var(--cs-sand)",
                        textTransform: "capitalize",
                      }}
                    >
                      {staff.tier}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {staff.completed} of {staff.total} bookings completed
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
                    {formatCurrency(staff.revenue)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    Revenue
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
