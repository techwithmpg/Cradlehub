"use client";

import { useTransition } from "react";
import { updateBranchServiceEligibilityAction } from "@/app/(dashboard)/owner/branches/actions";

type ServiceLite = {
  id: string;
  is_active: boolean;
  custom_price: number | null;
  available_in_spa: boolean;
  available_home_service: boolean;
  services: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
};

function EligibilityToggle({
  branchId,
  serviceId,
  label,
  value,
  otherValue,
  field,
}: {
  branchId: string;
  serviceId: string;
  label: string;
  value: boolean;
  otherValue: boolean;
  field: "spa" | "home";
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const nextSpa = field === "spa" ? !value : otherValue;
      const nextHome = field === "home" ? !value : otherValue;
      await updateBranchServiceEligibilityAction(branchId, serviceId, nextSpa, nextHome);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={`${value ? "Disable" : "Enable"} ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 4,
        border: "1px solid",
        fontSize: "0.6875rem",
        fontWeight: 600,
        cursor: isPending ? "default" : "pointer",
        transition: "opacity 0.15s",
        opacity: isPending ? 0.6 : 1,
        borderColor: value ? "#059669" : "var(--cs-border)",
        backgroundColor: value ? "#ECFDF5" : "transparent",
        color: value ? "#065F46" : "var(--cs-text-muted)",
      }}
    >
      {label}
    </button>
  );
}

export function BranchServicesPanel({
  branchId,
  services,
}: {
  branchId: string;
  services: ServiceLite[];
}) {
  const activeCount = services.filter((s) => s.is_active).length;

  return (
    <div>
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.625rem",
        }}
      >
        Services ({activeCount} active)
      </div>

      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {services.length === 0 ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              color: "var(--cs-text-muted)",
              fontSize: "0.875rem",
            }}
          >
            No services offered at this branch.
          </div>
        ) : (
          services.map((svc, i) => (
            <div
              key={svc.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.625rem 1rem",
                borderBottom:
                  i < services.length - 1 ? "1px solid var(--cs-border)" : "none",
                opacity: svc.is_active ? 1 : 0.45,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--cs-text)",
                    marginBottom: 2,
                  }}
                >
                  {svc.services?.name ?? "Unknown service"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                  {svc.services?.duration_minutes ?? 0} min
                  {svc.custom_price !== null ? ` · Custom ₱${svc.custom_price}` : ""}
                </div>
              </div>

              {svc.is_active && svc.services && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <EligibilityToggle
                    branchId={branchId}
                    serviceId={svc.services.id}
                    label="In-Spa"
                    value={svc.available_in_spa}
                    otherValue={svc.available_home_service}
                    field="spa"
                  />
                  <EligibilityToggle
                    branchId={branchId}
                    serviceId={svc.services.id}
                    label="Home"
                    value={svc.available_home_service}
                    otherValue={svc.available_in_spa}
                    field="home"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
