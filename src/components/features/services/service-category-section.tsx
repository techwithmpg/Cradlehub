"use client";

import { ServiceCard } from "./service-card";
import type { OwnerService, OwnerServiceBranch } from "./owner-service-types";

type Props = {
  categoryName: string;
  services: OwnerService[];
  branches: OwnerServiceBranch[];
  onEdit: (service: OwnerService) => void;
  onToggle?: (serviceId: string, nextValue: boolean) => void;
};

export function ServiceCategorySection({ categoryName, services, branches, onEdit, onToggle }: Props) {
  if (services.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {categoryName}
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            color: "var(--cs-text-subtle)",
            backgroundColor: "var(--cs-surface)",
            padding: "2px 8px",
            borderRadius: 100,
            border: "1px solid var(--cs-border)",
          }}
        >
          {services.length} service{services.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            branches={branches}
            onEdit={onEdit}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
