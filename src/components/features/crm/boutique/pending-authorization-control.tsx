"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CrmStatusBadge,
  type CrmStatusVariant,
} from "@/components/features/crm/premium/crm-status-badge";
import type { BoutiqueCapabilityGroup } from "@/lib/boutique/crm-boutique-model";

const GROUP_BADGE_MAP: Record<
  BoutiqueCapabilityGroup,
  { variant: CrmStatusVariant; label: string }
> = {
  functional: { variant: "active", label: "Functional" },
  marketing_governed: { variant: "info", label: "Marketing Managed" },
  pending_authorization: { variant: "active", label: "Authorized & Live" },
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
      label={group === "pending_authorization" ? "Authorized & Live" : (label ?? mapped.label)}
      size="sm"
    />
  );
}

export function PendingActionButton({
  label,
  reason,
  size = "sm",
  className,
  onClick,
}: {
  label: string;
  reason?: string;
  size?: "sm" | "default";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={onClick}
      title={reason ?? label}
      aria-label={label}
      className={className}
    >
      {onClick ? (
        <Sparkles className="size-3.5 text-[#1F4E33]" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-3.5 text-[#1F4E33]" aria-hidden="true" />
      )}
      <span>{label}</span>
    </Button>
  );
}
