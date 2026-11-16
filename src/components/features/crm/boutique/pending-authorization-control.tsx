"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrmStatusBadge, type CrmStatusVariant } from "@/components/features/crm/premium/crm-status-badge";
import type { BoutiqueCapabilityGroup } from "@/lib/boutique/crm-boutique-model";

const GROUP_BADGE_MAP: Record<BoutiqueCapabilityGroup, { variant: CrmStatusVariant; label: string }> = {
  functional: { variant: "active", label: "Functional" },
  marketing_governed: { variant: "info", label: "Marketing Managed" },
  pending_authorization: { variant: "warning", label: "Pending Authorization" },
};

export function CapabilityStatusTag({
  group,
  label,
}: {
  group: BoutiqueCapabilityGroup;
  label?: string;
}) {
  const mapped = GROUP_BADGE_MAP[group];
  return (
    <CrmStatusBadge
      variant={mapped.variant}
      label={label ?? mapped.label}
      size="sm"
    />
  );
}

export function PendingActionButton({
  label,
  reason,
  size = "sm",
  className,
}: {
  label: string;
  reason: string;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled
      title={`${label} — Pending operational authorization: ${reason}`}
      aria-label={`${label} (Pending operational authorization)`}
      className={className}
    >
      <Lock className="size-3.5" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}
