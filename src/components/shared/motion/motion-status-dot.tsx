"use client";

type MotionStatusDotProps = {
  state: "done" | "active" | "pending" | "warning";
};

export function MotionStatusDot({ state }: MotionStatusDotProps) {
  if (state === "done") {
    return (
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: "var(--cs-success)",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    );
  }

  if (state === "active") {
    return (
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          width: 7,
          height: 7,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: "#C8A96B",
            animation: "cradle-premium-pulse 1.6s ease-in-out infinite",
          }}
        />
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: "#C8A96B",
            display: "inline-block",
            position: "relative",
          }}
        />
      </span>
    );
  }

  if (state === "warning") {
    return (
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: "var(--cs-warning)",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: "var(--cs-border-strong)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
