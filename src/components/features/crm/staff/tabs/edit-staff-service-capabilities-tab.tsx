"use client";

import { StaffServiceCapabilitiesSummary } from "../staff-service-capabilities-summary";
import type { StaffProfileService } from "../edit-staff-profile-types";

export function EditStaffServiceCapabilitiesTab({
  services,
  onEditServices,
  disabled,
}: {
  services: StaffProfileService[];
  onEditServices: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <StaffServiceCapabilitiesSummary
        services={services}
        onEditServices={onEditServices}
        disabled={disabled}
      />
      <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-3 text-xs leading-5 text-[var(--cs-text-muted)]">
        This profile view shows a compact summary only. Use the dedicated
        service capabilities editor to change assignments safely.
      </div>
    </div>
  );
}
