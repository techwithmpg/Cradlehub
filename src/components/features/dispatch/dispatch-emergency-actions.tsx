/**
 * DispatchEmergencyActions
 *
 * Emergency link card for quick navigation to related operational pages.
 * Links only — no mutation logic.
 */

import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { CrmSectionCard } from "@/components/features/crm/shared/crm-cards";

const EMERGENCY_LINKS = [
  { label: "Review Home-Service Bookings", href: "/crm/bookings" },
  { label: "Open Daily Timeline", href: "/crm/schedule" },
  { label: "Open Schedule Setup", href: "/crm/schedule?tab=setup" },
  { label: "Open Daily Operations", href: "/crm/today" },
  { label: "Open Customer Records", href: "/crm/customers" },
  { label: "Open Notifications", href: "/crm/notifications" },
];

export function DispatchEmergencyActions() {
  return (
    <CrmSectionCard
      title="Emergency Dispatch Actions"
      description="Jump directly to related booking and schedule workspaces."
      icon={<ShieldAlert className="size-4 text-[#B42318]" />}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EMERGENCY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 py-2 text-[0.8125rem] font-medium text-[var(--cs-text-secondary)] transition hover:border-[#CFE5D6] hover:bg-[#FAF8F5] hover:text-[var(--cs-text)]"
          >
            <span className="truncate">{link.label}</span>
            <ArrowRight className="size-3.5 shrink-0 text-[var(--cs-text-muted)]" />
          </Link>
        ))}
      </div>
    </CrmSectionCard>
  );
}
