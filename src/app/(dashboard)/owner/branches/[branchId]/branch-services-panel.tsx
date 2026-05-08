"use client";

import { useState, useTransition } from "react";
import {
  addBranchServiceAction,
  removeBranchServiceAction,
  updateBranchServiceEligibilityAction,
  updateBranchServicePriceAction,
  updateBranchServiceVisibilityAction,
} from "@/app/(dashboard)/owner/branches/actions";

export type ServiceLite = {
  id: string;
  is_active: boolean;
  custom_price: number | null;
  available_in_spa: boolean;
  available_home_service: boolean;
  booking_visibility: string;
  services: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
};

export type GlobalService = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};

const VISIBILITY_LABELS: Record<string, string> = {
  public:   "Public",
  csr_only: "CSR Only",
  vip:      "VIP",
};

const VISIBILITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  public:   { bg: "#ECFDF5", color: "#065F46", border: "#059669" },
  csr_only: { bg: "#EFF6FF", color: "#1E40AF", border: "#3B82F6" },
  vip:      { bg: "#FDF4FF", color: "#6B21A8", border: "#A855F7" },
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

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const nextSpa  = field === "spa"  ? !value : otherValue;
          const nextHome = field === "home" ? !value : otherValue;
          await updateBranchServiceEligibilityAction(branchId, serviceId, nextSpa, nextHome);
        })
      }
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

function VisibilitySelect({
  branchId,
  serviceId,
  value,
}: {
  branchId: string;
  serviceId: string;
  value: string;
}) {
  const [isPending, startTransition] = useTransition();
  const colors = VISIBILITY_COLORS[value] ?? VISIBILITY_COLORS["public"]!;

  return (
    <select
      value={value}
      disabled={isPending}
      title="Booking visibility"
      onChange={(e) => {
        const next = e.target.value as "public" | "csr_only" | "vip";
        startTransition(async () => {
          await updateBranchServiceVisibilityAction(branchId, serviceId, next);
        });
      }}
      style={{
        padding: "2px 6px",
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        fontSize: "0.6875rem",
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.color,
        cursor: isPending ? "default" : "pointer",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <option value="public">Public</option>
      <option value="csr_only">CSR Only</option>
      <option value="vip">VIP</option>
    </select>
  );
}

function PriceCell({
  branchId,
  serviceId,
  customPrice,
  basePrice,
}: {
  branchId: string;
  serviceId: string;
  customPrice: number | null;
  basePrice: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(customPrice ?? basePrice));
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(customPrice ?? basePrice));
          setEditing(true);
        }}
        title="Edit price"
        style={{
          fontSize: "0.75rem",
          color: customPrice !== null ? "#1D4ED8" : "var(--cs-text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 2px",
          textDecoration: customPrice !== null ? "underline dotted" : "none",
        }}
      >
        ₱{(customPrice ?? basePrice).toLocaleString()}
        {customPrice !== null && " (custom)"}
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <input
        type="number"
        value={draft}
        min={0}
        placeholder="Price"
        aria-label="Custom price"
        onChange={(e) => setDraft(e.target.value)}
        style={{
          width: 72,
          padding: "1px 4px",
          fontSize: "0.75rem",
          border: "1px solid var(--cs-border)",
          borderRadius: 4,
        }}
        autoFocus
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const parsed = parseFloat(draft);
            const next = isNaN(parsed) ? null : parsed;
            await updateBranchServicePriceAction(branchId, serviceId, next);
            setEditing(false);
          })
        }
        style={{ fontSize: "0.6875rem", color: "#059669", border: "none", background: "none", cursor: "pointer" }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", border: "none", background: "none", cursor: "pointer" }}
      >
        Cancel
      </button>
      {customPrice !== null && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateBranchServicePriceAction(branchId, serviceId, null);
              setEditing(false);
            })
          }
          style={{ fontSize: "0.6875rem", color: "#991B1B", border: "none", background: "none", cursor: "pointer" }}
        >
          Reset
        </button>
      )}
    </span>
  );
}

function RemoveButton({ branchId, serviceId }: { branchId: string; serviceId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await removeBranchServiceAction(branchId, serviceId);
        })
      }
      title="Remove service from branch"
      style={{
        padding: "2px 6px",
        borderRadius: 4,
        border: "1px solid var(--cs-border)",
        fontSize: "0.6875rem",
        color: "#991B1B",
        background: "transparent",
        cursor: isPending ? "default" : "pointer",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      Remove
    </button>
  );
}

function AddServiceRow({
  branchId,
  availableToAdd,
}: {
  branchId: string;
  availableToAdd: GlobalService[];
}) {
  const [selectedId, setSelectedId] = useState("");
  const [isPending, startTransition] = useTransition();

  if (availableToAdd.length === 0) return null;

  return (
    <div
      style={{
        padding: "0.625rem 1rem",
        borderTop: "1px dashed var(--cs-border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={isPending}
        title="Add service from catalog"
        style={{
          flex: 1,
          padding: "4px 6px",
          fontSize: "0.8125rem",
          border: "1px solid var(--cs-border)",
          borderRadius: 6,
          background: "var(--cs-bg)",
          color: "var(--cs-text)",
        }}
      >
        <option value="">Add service from catalog…</option>
        {availableToAdd.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.duration_minutes} min · ₱{s.price.toLocaleString()})
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selectedId || isPending}
        onClick={() =>
          startTransition(async () => {
            if (!selectedId) return;
            await addBranchServiceAction(branchId, selectedId);
            setSelectedId("");
          })
        }
        style={{
          padding: "4px 14px",
          borderRadius: 6,
          border: "none",
          backgroundColor: selectedId ? "var(--cs-accent)" : "var(--cs-border)",
          color: selectedId ? "#fff" : "var(--cs-text-muted)",
          fontSize: "0.8125rem",
          fontWeight: 600,
          cursor: !selectedId || isPending ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        Add
      </button>
    </div>
  );
}

export function BranchServicesPanel({
  branchId,
  services,
  allServices = [],
  isOwner = false,
}: {
  branchId: string;
  services: ServiceLite[];
  allServices?: GlobalService[];
  isOwner?: boolean;
}) {
  const activeServices = services.filter((s) => s.is_active);
  const activeServiceIds = new Set(
    activeServices.map((s) => s.services?.id).filter(Boolean)
  );
  const availableToAdd = allServices.filter((s) => !activeServiceIds.has(s.id));

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
        Services ({activeServices.length} active)
      </div>

      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {activeServices.length === 0 ? (
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
          activeServices.map((svc, i) => (
            <div
              key={svc.id}
              style={{
                padding: "0.625rem 1rem",
                borderBottom: i < activeServices.length - 1 ? "1px solid var(--cs-border)" : "none",
              }}
            >
              {/* Top row: name + remove */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div
                  style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}
                >
                  {svc.services?.name ?? "Unknown service"}
                </div>
                {svc.services && (
                  <RemoveButton branchId={branchId} serviceId={svc.services.id} />
                )}
              </div>

              {/* Bottom row: meta + controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                  {svc.services?.duration_minutes ?? 0} min
                </span>

                {/* Price */}
                {svc.services && isOwner ? (
                  <PriceCell
                    branchId={branchId}
                    serviceId={svc.services.id}
                    customPrice={svc.custom_price}
                    basePrice={svc.services.price}
                  />
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    ₱{(svc.custom_price ?? svc.services?.price ?? 0).toLocaleString()}
                    {svc.custom_price !== null && " (custom)"}
                  </span>
                )}

                {/* Eligibility */}
                {svc.services && (
                  <>
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
                  </>
                )}

                {/* Visibility (owner only) */}
                {svc.services && isOwner && (
                  <VisibilitySelect
                    branchId={branchId}
                    serviceId={svc.services.id}
                    value={svc.booking_visibility || "public"}
                  />
                )}

                {/* Visibility badge (non-owner, non-public) */}
                {!isOwner && svc.booking_visibility && svc.booking_visibility !== "public" && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 4,
                      ...(VISIBILITY_COLORS[svc.booking_visibility] ?? VISIBILITY_COLORS["public"]!),
                      border: `1px solid ${(VISIBILITY_COLORS[svc.booking_visibility] ?? VISIBILITY_COLORS["public"]!).border}`,
                    }}
                  >
                    {VISIBILITY_LABELS[svc.booking_visibility] ?? svc.booking_visibility}
                  </span>
                )}
              </div>
            </div>
          ))
        )}

        <AddServiceRow branchId={branchId} availableToAdd={availableToAdd} />
      </div>
    </div>
  );
}
