"use client";

type LivePulseIndicatorProps = {
  label: string;
  tone?: "success" | "gold" | "muted";
};

export function LivePulseIndicator({ label, tone = "success" }: LivePulseIndicatorProps) {
  const dotColor =
    tone === "gold"
      ? "#C8A96B"
      : tone === "muted"
      ? "var(--cs-border-strong)"
      : "var(--cs-success)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        color: "var(--cs-text-muted)",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          width: 8,
          height: 8,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            width: 16,
            height: 16,
            borderRadius: "50%",
            backgroundColor: dotColor,
            animation: "cradle-premium-pulse 1.6s ease-in-out infinite",
          }}
        />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: dotColor,
            display: "inline-block",
            position: "relative",
          }}
        />
      </span>
      {label}
    </div>
  );
}
