import type { ReactNode } from "react";
import { ArrowRight, Settings2 } from "lucide-react";
import { CrmActionCard } from "@/components/features/crm/shared/crm-cards";

export function SetupShortcutCard({
  icon,
  label,
  description,
  href,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  href: string;
}) {
  const resolvedIcon = typeof icon === "string" ? <Settings2 className="size-4" /> : icon;

  return (
    <CrmActionCard
      title={label}
      description={description}
      icon={resolvedIcon}
      href={href}
      trailing={
        <ArrowRight className="size-4 text-[var(--cs-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1F4E33]" />
      }
    />
  );
}
