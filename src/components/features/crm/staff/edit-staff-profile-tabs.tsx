"use client";

import {
  BriefcaseBusiness,
  IdCard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffProfileTab } from "./edit-staff-profile-types";

const TABS: Array<{
  key: StaffProfileTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "profile", label: "Profile Info", icon: IdCard },
  { key: "work", label: "Work Setup", icon: BriefcaseBusiness },
  { key: "access", label: "Access & Status", icon: ShieldCheck },
  { key: "services", label: "Service Capabilities", icon: Sparkles },
];

export function EditStaffProfileTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: StaffProfileTab;
  onTabChange: (tab: StaffProfileTab) => void;
}) {
  return (
    <div className="shrink-0 border-b border-[var(--cs-border)] bg-[var(--cs-surface)] px-6 py-3">
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-1"
        role="tablist"
        aria-label="Edit staff profile sections"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "relative inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30",
                isActive
                  ? "border border-[var(--cs-sand)]/30 bg-white text-[var(--cs-sand)] shadow-[var(--cs-shadow-xs)]"
                  : "border border-transparent text-[var(--cs-text-muted)] hover:bg-white/70 hover:text-[var(--cs-text)]"
              )}
            >
              <Icon className="size-4" />
              <span className="whitespace-nowrap">{tab.label}</span>
              {isActive ? (
                <span className="absolute inset-x-4 -bottom-1 h-0.5 rounded-full bg-[var(--cs-sand)]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
