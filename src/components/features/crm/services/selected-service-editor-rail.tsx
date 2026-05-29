"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  EyeOff,
  Home,
  MapPin,
  Pencil,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { updateBranchServiceEligibilityAction } from "@/app/(dashboard)/owner/branches/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CustomizationRow } from "./customization-rows";
import type { DeliveryMode } from "./service-customization-tab";
import { updateBranchServiceDeliveryModeAction } from "@/app/(dashboard)/owner/branches/actions";
import { updateBranchServiceVisibilityAction } from "@/app/(dashboard)/owner/branches/actions";

export function SelectedServiceEditorRail({
  branchId,
  branchName,
  row,
  onClose,
}: {
  branchId: string;
  branchName: string;
  row: CustomizationRow | null;
  onClose: () => void;
}) {
  if (!row) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--cs-border-strong)] bg-[var(--cs-surface-warm)] p-6 text-center text-sm text-[var(--cs-text-muted)]">
        Select a service to view and edit details.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-sm)]">
      <RailHeader row={row} onClose={onClose} />
      <div className="space-y-5 p-5">
        <DeliveryModeSection branchId={branchId} row={row} />
        <HomeServiceToggleSection branchId={branchId} row={row} />
        <PublicVisibilitySection branchId={branchId} row={row} />
        <ReadinessChecklist row={row} />
        <QuickActions row={row} />
      </div>
      <div className="border-t border-[var(--cs-border-soft)] px-5 py-3 text-[0.6875rem] text-[var(--cs-text-muted)]">
        {branchName} · Last updated: just now
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function RailHeader({ row, onClose }: { row: CustomizationRow; onClose: () => void }) {
  const initials = row.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-start gap-3 border-b border-[var(--cs-border-soft)] p-4">
      {row.imageUrl ? (
        <Image
          src={row.imageUrl}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="size-12 shrink-0 rounded-xl border border-[var(--cs-border)] object-cover"
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-[var(--cs-sand-mist)] text-sm font-semibold text-[var(--cs-sand-dark)]">
          {initials || "S"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold text-[var(--cs-text)] truncate">{row.name}</p>
        <p className="m-0 text-xs text-[var(--cs-text-muted)]">
          {row.category ?? "Service"} · {row.duration} min · ₱{row.price.toLocaleString()}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {row.isActive ? (
            <span className="inline-flex items-center rounded-full border border-[#CFE4D5] bg-[var(--cs-success-bg)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--cs-success-text)]">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--cs-text-muted)]">
              Inactive
            </span>
          )}
          {row.visibility === "public" && (
            <span className="inline-flex items-center rounded-full border border-[#CFE4D5] bg-[var(--cs-success-bg)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--cs-success-text)]">
              Public
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
        aria-label="Close editor"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ── Delivery Mode ─────────────────────────────────────────────────────────────

function DeliveryModeSection({ branchId, row }: { branchId: string; row: CustomizationRow }) {
  const [isPending, startTransition] = useTransition();
  const [localMode, setLocalMode] = useState<DeliveryMode>(row.deliveryMode);

  const handleChange = (mode: DeliveryMode) => {
    setLocalMode(mode);
    startTransition(async () => {
      const res = await updateBranchServiceDeliveryModeAction(branchId, row.serviceId, mode);
      if (!res.success) {
        console.error("[delivery mode] update failed", res.error);
        setLocalMode(row.deliveryMode);
      }
    });
  };

  const modes: { value: DeliveryMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      value: "in_spa",
      label: "In-Spa Only",
      icon: <MapPin className="size-4" />,
      desc: "Customer comes to branch",
    },
    {
      value: "home_service",
      label: "Home-Service",
      icon: <Home className="size-4" />,
      desc: "Staff travels to customer",
    },
    {
      value: "both",
      label: "Both",
      icon: <MapPin className="size-4" />,
      desc: "Available for both",
    },
    {
      value: "hidden",
      label: "Hidden",
      icon: <EyeOff className="size-4" />,
      desc: "Not visible or bookable",
    },
  ];

  return (
    <section>
      <h3 className="m-0 mb-3 text-sm font-semibold text-[var(--cs-text)]">Delivery Mode</h3>
      <div className="grid grid-cols-2 gap-2">
        {modes.map((m) => {
          const active = localMode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              disabled={isPending}
              onClick={() => handleChange(m.value)}
              className={[
                "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                active
                  ? "border-[var(--cs-sand)] bg-[var(--cs-sand-tint)]"
                  : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:bg-[var(--cs-surface-warm)]",
              ].join(" ")}
            >
              <span className={active ? "text-[var(--cs-sand-dark)]" : "text-[var(--cs-text-muted)]"}>
                {m.icon}
              </span>
              <span className="text-xs font-semibold text-[var(--cs-text)]">{m.label}</span>
              <span className="text-[0.6875rem] text-[var(--cs-text-muted)]">{m.desc}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Home Service Toggle ───────────────────────────────────────────────────────

function HomeServiceToggleSection({ branchId, row }: { branchId: string; row: CustomizationRow }) {
  const [isPending, startTransition] = useTransition();
  const [localValue, setLocalValue] = useState(row.isHomeService);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleToggle = (checked: boolean) => {
    setSaveError(null);
    setLocalValue(checked);
    startTransition(async () => {
      const res = await updateBranchServiceEligibilityAction(
        branchId,
        row.serviceId,
        row.isInSpa,
        checked
      );
      if (!res.success) {
        setSaveError(res.error ?? "Update failed. Please try again.");
        setLocalValue(!checked);
      }
    });
  };

  const showInactiveWarning = localValue && !row.isActive;
  const showVisibilityWarning = localValue && row.isActive && row.visibility !== "public";

  return (
    <section>
      <div className="flex items-center justify-between rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3">
        <div className="flex items-center gap-2">
          <Home className="size-4 text-[var(--cs-text-muted)]" />
          <div>
            <p className="m-0 text-sm font-medium text-[var(--cs-text)]">Home Service</p>
            <p className="m-0 text-xs text-[var(--cs-text-muted)]">
              Allow this service for home-service bookings
            </p>
          </div>
        </div>
        <Switch
          checked={localValue}
          onCheckedChange={handleToggle}
          disabled={isPending}
        />
      </div>

      {saveError && (
        <p className="mt-1.5 rounded-lg border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] px-3 py-2 text-xs text-[var(--cs-error-text)]">
          {saveError}
        </p>
      )}

      {showInactiveWarning && (
        <p className="mt-1.5 rounded-lg border border-[#FDE68A] bg-[var(--cs-warning-bg)] px-3 py-2 text-xs text-[var(--cs-warning-text)]">
          ⚠️ This service is inactive. Use the <strong>Delivery Mode</strong> selector above to set it to &quot;Home-Service&quot; or &quot;Both&quot; — that will also activate it.
        </p>
      )}

      {showVisibilityWarning && (
        <p className="mt-1.5 rounded-lg border border-[#FDE68A] bg-[var(--cs-warning-bg)] px-3 py-2 text-xs text-[var(--cs-warning-text)]">
          ⚠️ This service is set to <strong>{row.visibility === "csr_only" ? "CSR Only" : row.visibility}</strong>. Enable <strong>Public Booking</strong> above for customers to see it online.
        </p>
      )}
    </section>
  );
}

// ── Public Visibility ─────────────────────────────────────────────────────────

function PublicVisibilitySection({ branchId, row }: { branchId: string; row: CustomizationRow }) {
  const [isPending, startTransition] = useTransition();
  const [localPublic, setLocalPublic] = useState(row.visibility === "public" && row.isActive);

  const handleToggle = (checked: boolean) => {
    setLocalPublic(checked);
    const nextVisibility: "public" | "csr_only" = checked ? "public" : "csr_only";
    startTransition(async () => {
      const res = await updateBranchServiceVisibilityAction(branchId, row.serviceId, nextVisibility);
      if (!res.success) {
        console.error("[visibility] update failed", res.error);
        setLocalPublic(!checked);
      }
    });
  };

  return (
    <section>
      <h3 className="m-0 mb-3 text-sm font-semibold text-[var(--cs-text)]">Public Booking</h3>
      <div className="space-y-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 text-sm font-medium text-[var(--cs-text)]">Visible to public</p>
            <p className="m-0 text-xs text-[var(--cs-text-muted)]">
              Show in public catalog and booking wizard
            </p>
          </div>
          <Switch
            checked={localPublic}
            onCheckedChange={handleToggle}
            disabled={isPending || !row.isActive}
          />
        </div>
        {!row.isActive && (
          <p className="m-0 text-xs text-[var(--cs-warning-text)]">
            Service must be active before it can be made public.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Readiness Checklist ───────────────────────────────────────────────────────

function ReadinessChecklist({ row }: { row: CustomizationRow }) {
  const items = [
    {
      label: "Active service",
      ok: row.isActive,
      fixHref: null,
      note: !row.isActive ? "Use Delivery Mode above to activate" : null,
    },
    {
      label: "At least one provider assigned",
      ok: row.providerCount > 0,
      fixHref: `/crm/staff?tab=assignments`,
      note: null,
    },
    {
      label: "Public visibility enabled",
      ok: row.visibility === "public",
      fixHref: null,
      note: row.visibility !== "public" ? "Toggle Public Booking above" : null,
    },
    {
      label: "Available for in-spa or home-service",
      ok: row.isInSpa || row.isHomeService,
      fixHref: null,
      note: null,
    },
  ];

  return (
    <section>
      <h3 className="m-0 mb-3 text-sm font-semibold text-[var(--cs-text)]">Readiness Checklist</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {item.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-[var(--cs-success-text)]" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-[var(--cs-error-text)]" />
                )}
                <span className={item.ok ? "text-sm text-[var(--cs-text)]" : "text-sm text-[var(--cs-error-text)]"}>
                  {item.label}
                </span>
              </div>
              {!item.ok && item.fixHref && (
                <Link
                  href={item.fixHref}
                  className="text-xs font-medium text-[var(--cs-sand-dark)] hover:underline"
                >
                  Fix
                </Link>
              )}
            </div>
            {!item.ok && item.note && (
              <p className="ml-6 text-[0.6875rem] text-[var(--cs-text-muted)]">
                → {item.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

function QuickActions({ row }: { row: CustomizationRow }) {
  return (
    <section>
      <h3 className="m-0 mb-3 text-sm font-semibold text-[var(--cs-text)]">Quick Actions</h3>
      <div className="grid gap-2">
        <Button
          asChild
          variant="outline"
          size="lg"
          className="justify-start border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-sand-tint)]"
        >
          <Link href={`/crm/staff?tab=assignments`}>
            <Pencil className="mr-2 size-4" />
            Manage Providers
          </Link>
        </Button>
        {row.providerCount === 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-[#E7D9B8] bg-[var(--cs-warning-bg)] p-2.5 text-xs text-[var(--cs-warning-text)]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>No providers assigned. Customers cannot book this service.</span>
          </div>
        )}
      </div>
    </section>
  );
}
