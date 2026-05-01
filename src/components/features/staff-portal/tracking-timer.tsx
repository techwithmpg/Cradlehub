"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [m.toString().padStart(2, "0"), s.toString().padStart(2, "0")];
  if (h > 0) parts.unshift(h.toString());
  return parts.join(":");
}

type TrackingTimerProps = {
  startTimestamp: string;
};

export function TrackingTimer({ startTimestamp }: TrackingTimerProps) {
  const [elapsed, setElapsed] = useState(() => {
    const start = new Date(startTimestamp).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - start) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(startTimestamp).getTime();
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTimestamp]);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--cs-sand-dark)",
        backgroundColor: "var(--cs-sand-mist)",
        padding: "3px 10px",
        borderRadius: "var(--cs-r-pill)",
      }}
    >
      <Timer size={12} />
      Tracking active &middot; {formatElapsed(elapsed)}
    </div>
  );
}
