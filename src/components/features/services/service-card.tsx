"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServiceImageThumbnail } from "./service-image-thumbnail";
import { ServiceStatusToggle } from "./service-status-toggle";
import { deleteServiceAction } from "@/app/(dashboard)/owner/services/actions";
import { formatCurrency } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2, EyeOff, Eye } from "lucide-react";

type ServiceCategory = {
  id: string;
  name: string | null;
  display_order: number | null;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  service_categories: ServiceCategory | null;
};

type Props = {
  service: Service;
  onToggle?: (serviceId: string, nextValue: boolean) => void;
  onDeleted?: (serviceId: string) => void;
};

export function ServiceCard({ service, onToggle, onDeleted }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isHovered, setIsHovered] = useState(false);

  const categoryName = service.service_categories?.name ?? "Uncategorized";
  const isInactive = !service.is_active;

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${service.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteServiceAction({ serviceId: service.id });
      if (!result.ok) {
        console.error("[DELETE_SERVICE_FAILED]", result.message);
        alert("Could not delete service. Please try again.");
        return;
      }
      onDeleted?.(service.id);
    });
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--cs-surface)",
        border: `1px solid ${isHovered ? "var(--cs-sand-light)" : "var(--cs-border)"}`,
        borderRadius: "var(--cs-r-lg)",
        overflow: "hidden",
        transition: "all 200ms ease",
        transform: isHovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: isHovered
          ? "0 8px 24px rgba(30,25,22,0.08)"
          : "var(--cs-shadow-xs)",
        opacity: isInactive ? 0.72 : 1,
      }}
    >
      {/* Image */}
      <ServiceImageThumbnail serviceName={service.name} />

      {/* Content */}
      <div style={{ padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
          <h3
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              lineHeight: 1.3,
              flex: 1,
            }}
          >
            {service.name}
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
            color: "var(--cs-text-muted)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.3em",
          }}
        >
          {service.description || "No description provided."}
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
          {categoryName}
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
              {service.duration_minutes} min
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginBottom: 2 }}>Price</div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)" }}>
              {formatCurrency(Number(service.price))}
            </div>
          </div>
        </div>

        {/* Active toggle row */}
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
          <div>
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
          </div>
          <ServiceStatusToggle
            serviceId={service.id}
            serviceName={service.name}
            isActive={service.is_active}
            onToggle={onToggle}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            borderTop: "1px solid var(--cs-border-soft)",
            paddingTop: "0.625rem",
            marginTop: "auto",
          }}
        >
          <Link
            href={`/owner/services/${service.id}`}
            className="cs-btn cs-btn-ghost cs-btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  disabled={isPending}
                  className="cs-btn cs-btn-ghost cs-btn-sm"
                  style={{ padding: "4px 6px" }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isPending}
                style={{ color: "#DC2626", cursor: "pointer" }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
