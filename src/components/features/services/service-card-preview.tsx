"use client";

import { ServiceImageThumbnail } from "./service-image-thumbnail";
import { formatCurrency } from "@/lib/utils";
import { EyeOff, Eye } from "lucide-react";

type Props = {
  name: string;
  description: string;
  categoryName: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
};

export function ServiceCardPreview({
  name,
  description,
  categoryName,
  durationMinutes,
  price,
  isActive,
}: Props) {
  const isInactive = !isActive;
  const displayName = name.trim() || "Service name";
  const displayDesc = description.trim() || "Service description will appear here.";
  const displayCategory = categoryName || "Uncategorized";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: "var(--cs-r-lg)",
        overflow: "hidden",
        boxShadow: "var(--cs-shadow-xs)",
        opacity: isInactive ? 0.72 : 1,
      }}
    >
      <ServiceImageThumbnail serviceName={displayName} />

      <div style={{ padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
          <h3
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: name.trim() ? "var(--cs-text)" : "var(--cs-text-subtle)",
              lineHeight: 1.3,
              flex: 1,
            }}
          >
            {displayName}
          </h3>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 100,
              whiteSpace: "nowrap",
              flexShrink: 0,
              backgroundColor: isInactive ? "#F5F5F5" : "#E8F5E9",
              color: isInactive ? "#9E9E9E" : "#2E7D32",
            }}
          >
            {isInactive ? "Inactive" : "Active"}
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: "0.8125rem",
            color: description.trim() ? "var(--cs-text-muted)" : "var(--cs-text-subtle)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.3em",
          }}
        >
          {displayDesc}
        </p>

        {/* Category badge */}
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "3px 10px",
            borderRadius: 100,
            backgroundColor: "var(--cs-sand-mist)",
            color: "var(--cs-sand)",
            width: "fit-content",
          }}
        >
          {displayCategory}
        </span>

        {/* Duration + Price */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            padding: "0.625rem",
            borderRadius: "var(--cs-r-md)",
            backgroundColor: "var(--cs-bg)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginBottom: 2 }}>Duration</div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text)" }}>
              {durationMinutes || 0} min
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginBottom: 2 }}>Price</div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)" }}>
              {formatCurrency(price || 0)}
            </div>
          </div>
        </div>

        {/* Active toggle row preview */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 0.625rem",
            borderRadius: "var(--cs-r-md)",
            backgroundColor: isInactive ? "var(--cs-bg)" : "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
          }}
        >
          <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text)" }}>
            {isInactive ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <EyeOff className="h-3.5 w-3.5" style={{ color: "var(--cs-text-muted)" }} />
                Hidden from booking
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Eye className="h-3.5 w-3.5" style={{ color: "#4A7C59" }} />
                Visible to customers
              </span>
            )}
          </div>
          {/* Static toggle visual */}
          <div
            style={{
              position: "relative",
              width: 44,
              height: 24,
              borderRadius: 12,
              padding: 2,
              backgroundColor: isActive ? "#4A7C59" : "var(--cs-border)",
            }}
          >
            <span
              style={{
                display: "block",
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                transform: isActive ? "translateX(20px)" : "translateX(0)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
