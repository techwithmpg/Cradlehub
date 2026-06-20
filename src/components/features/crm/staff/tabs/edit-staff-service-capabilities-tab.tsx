"use client";

import { StaffServiceCapabilitiesSummary } from "../staff-service-capabilities-summary";
import type { StaffProfileService } from "../edit-staff-profile-types";

export function EditStaffServiceCapabilitiesTab({
  services,
  onEditServices,
  loadError,
  disabled,
}: {
  services: StaffProfileService[];
  onEditServices: () => void;
  loadError?: string | null;
  disabled?: boolean;
}) {
  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
        {loadError}
      </div>
    );
  }

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
