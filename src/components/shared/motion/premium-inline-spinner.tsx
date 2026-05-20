"use client";

type PremiumInlineSpinnerProps = {
  className?: string;
};

export function PremiumInlineSpinner({ className }: PremiumInlineSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`animate-spin shrink-0 ${className ?? ""}`}
      style={{
        display: "inline-block",
        width: 13,
        height: 13,
        borderRadius: "50%",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
      }}
    />
  );
}
