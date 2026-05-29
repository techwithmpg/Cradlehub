"use client";

import { cn } from "@/lib/utils";

export function SetupProgressRing({
  percentage,
  size = 120,
  strokeWidth = 10,
  className,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 80
      ? "#5A8A6A"
      : percentage >= 50
        ? "#A67B5B"
        : "#c0392b";

  const trackColor = "#E8E0D8";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {percentage}%
        </span>
        <span className="text-[0.625rem] font-medium uppercase tracking-wide" style={{ color }}>
          {percentage >= 80 ? "Ready" : percentage >= 50 ? "Almost" : "Needs Work"}
        </span>
      </div>
    </div>
  );
}
