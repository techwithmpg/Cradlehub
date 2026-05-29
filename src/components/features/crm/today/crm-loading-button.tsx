"use client";

import { useState, useCallback } from "react";

export function CrmLoadingButton({
  label,
  loadingLabel,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  style,
}: {
  label: string;
  loadingLabel?: string;
  onClick?: () => Promise<void> | void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (!onClick || isLoading || disabled) return;
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  }, [onClick, isLoading, disabled]);

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "var(--cs-sand)",
      color: "#fff",
      border: "none",
    },
    secondary: {
      backgroundColor: "var(--cs-surface)",
      color: "var(--cs-text)",
      border: "1px solid var(--cs-border)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--cs-text-secondary)",
      border: "1px solid transparent",
    },
    danger: {
      backgroundColor: "var(--cs-error-bg)",
      color: "var(--cs-error)",
      border: "1px solid var(--cs-error)",
    },
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0.5rem 0.875rem",
        borderRadius: "var(--cs-r-md)",
        fontSize: "0.8125rem",
        fontWeight: 600,
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        opacity: disabled || isLoading ? 0.65 : 1,
        transition: "opacity 150ms ease",
        ...variantStyles[variant],
        ...style,
      }}
    >
      {isLoading && (
        <span
          style={{
            width: 14,
            height: 14,
            border: `2px solid ${variant === "primary" ? "rgba(255,255,255,0.3)" : "var(--cs-border-strong)"}`,
            borderTopColor: variant === "primary" ? "#fff" : "var(--cs-sand)",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
            display: "inline-block",
          }}
        />
      )}
      {isLoading && loadingLabel ? loadingLabel : label}
    </button>
  );
}
