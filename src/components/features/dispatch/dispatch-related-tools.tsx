/**
 * DispatchRelatedTools
 *
 * Related tool navigation links for the dispatch workspace.
 * Links only — no mutation logic.
 */

import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { CrmSectionCard } from "@/components/features/crm/shared/crm-cards";

const RELATED_TOOLS = [
  { label: "Daily Operations Center", href: "/crm/today" },
  { label: "Daily Timeline", href: "/crm/schedule" },
  { label: "Schedule Setup", href: "/crm/schedule?tab=setup" },
  { label: "Services & Therapist Setup", href: "/crm/services" },
  { label: "Spaces & Booking Rules", href: "/crm/spaces-rules" },
  { label: "Rules & Setup Center", href: "/crm/setup" },
];

export function DispatchRelatedTools() {
  return (
    <CrmSectionCard
      title="Related Tools"
      description="Shortcuts across daily operations and setup."
      icon={<Wrench className="size-4" />}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {RELATED_TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 py-2 text-[0.8125rem] font-medium text-[var(--cs-text-secondary)] transition hover:border-[#CFE5D6] hover:bg-[#FAF8F5] hover:text-[var(--cs-text)]"
          >
            <span className="truncate">{tool.label}</span>
            <ArrowRight className="size-3.5 shrink-0 text-[var(--cs-text-muted)]" />
          </Link>
        ))}
      </div>
    </CrmSectionCard>
  );
}
