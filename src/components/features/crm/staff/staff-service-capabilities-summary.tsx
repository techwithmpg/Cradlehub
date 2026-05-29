"use client";

import { ArrowRight, BadgeCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffProfileService } from "./edit-staff-profile-types";

export function StaffServiceCapabilitiesSummary({
  services,
  onEditServices,
  disabled,
}: {
  services: StaffProfileService[];
  onEditServices: () => void;
  disabled?: boolean;
}) {
  const visibleServices = services.slice(0, 5);
  const hiddenCount = Math.max(services.length - visibleServices.length, 0);
  const serviceLabel =
    services.length === 1 ? "Can perform 1 service" : `Can perform ${services.length} services`;

  return (
    <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[var(--cs-sand)]">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--cs-text)]">
                Service Capabilities
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#bdd7c2] bg-[#e8f5e9] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#276143]">
                <BadgeCheck className="size-3" />
                Summary
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">
              {services.length > 0 ? serviceLabel : "No services assigned yet"}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleServices.map((service) => (
                <span
                  key={service.id}
                  className="inline-flex items-center rounded-full bg-[var(--cs-sand)] px-2.5 py-1 text-[0.6875rem] font-semibold text-white"
                >
                  {service.name}
                </span>
              ))}
              {hiddenCount > 0 ? (
                <span className="inline-flex items-center rounded-full border border-[var(--cs-border)] bg-white px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--cs-text-muted)]">
                  +{hiddenCount} more
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onEditServices}
          disabled={disabled}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--cs-sand)]/50 px-4 text-sm font-semibold text-[var(--cs-sand)] transition",
            "hover:bg-[var(--cs-surface-warm)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30",
            disabled && "cursor-not-allowed opacity-60 hover:bg-transparent"
          )}
        >
          Edit Service Capabilities
          <ArrowRight className="size-4" />
        </button>
      </div>
    </section>
  );
}
