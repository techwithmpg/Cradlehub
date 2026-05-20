"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type PremiumSuccessToastProps = {
  open: boolean;
  title: string;
  description?: string;
  variant?: "success" | "warning" | "error";
};

export function PremiumSuccessToast({
  open,
  title,
  description,
  variant = "success",
}: PremiumSuccessToastProps) {
  if (!open) return null;

  const isSuccess = variant === "success";
  const isWarning = variant === "warning";

  const bg = isSuccess
    ? "var(--cs-success)"
    : isWarning
    ? "var(--cs-warning)"
    : "var(--cs-error)";

  const Icon = isSuccess ? CheckCircle2 : isWarning ? AlertTriangle : XCircle;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        zIndex: 50,
        animation: "cradle-soft-slide-up 0.3s var(--cs-ease) forwards",
        maxWidth: 320,
        width: "calc(100% - 2rem)",
      }}
    >
      <div
        style={{
          backgroundColor: bg,
          color: "#fff",
          borderRadius: "var(--cs-r-lg)",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          boxShadow: "0 8px 24px rgba(30,25,22,0.18)",
        }}
      >
        <span
          style={{
            animation: "cradle-check-pop 0.4s var(--cs-ease)",
            flexShrink: 0,
            marginTop: 1,
            display: "inline-flex",
          }}
        >
          <Icon size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
            {title}
          </div>
          {description && (
            <div
              style={{
                fontSize: 11.5,
                opacity: 0.85,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              {description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
