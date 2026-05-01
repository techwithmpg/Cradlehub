"use client";

import { BookingTrendData } from "@/lib/owner/reports";
import { TrendingUp } from "lucide-react";

interface BookingTrendCardProps {
  data: BookingTrendData[];
}

export function BookingTrendCard({ data }: BookingTrendCardProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalBookings = data.reduce((sum, d) => sum + d.count, 0);
  const avgBookings = data.length > 0 ? (totalBookings / data.length).toFixed(1) : 0;

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
        <TrendingUp size={18} />
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
          }}
        >
          Booking Trend
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            display: "flex",
            gap: "1rem",
          }}
        >
          <span>Total: <strong>{totalBookings}</strong></span>
          <span>Avg: <strong>{avgBookings}/day</strong></span>
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
          No trend data for this period
        </div>
      ) : (
        <div
          style={{
            height: 200,
            display: "flex",
            alignItems: "flex-end",
            gap: 4,
            paddingTop: "1rem",
          }}
        >
          {data.map((item) => {
            const height = (item.count / maxCount) * 100;
            const dateObj = new Date(item.date);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            
            return (
              <div
                key={item.date}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
                title={`${item.date}: ${item.count} bookings`}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${height}%`,
                    minHeight: item.count > 0 ? 4 : 0,
                    backgroundColor: isWeekend ? "var(--cs-sand)" : "var(--cs-sand-mist)",
                    borderRadius: "2px 2px 0 0",
                    transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                    position: "relative",
                  }}
                >
                  {item.count > 0 && data.length <= 14 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -18,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        color: "var(--cs-text-muted)",
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "0.75rem",
          fontSize: "0.625rem",
          color: "var(--cs-text-muted)",
          fontWeight: 500,
        }}
      >
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
