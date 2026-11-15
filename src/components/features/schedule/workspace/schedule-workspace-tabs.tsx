"use client";

import {
  CrmModuleTabs,
  type CrmModuleTabItem,
} from "@/components/features/crm/shared/crm-module-tabs";

export type ScheduleTabKey = "daily" | "setup" | "assistance";

const TABS: { key: ScheduleTabKey; label: string }[] = [
  { key: "daily", label: "Daily Timeline" },
  { key: "setup", label: "Schedule Setup" },
  { key: "assistance", label: "Assistance" },
];

export function ScheduleWorkspaceTabs({
  activeTab,
  onTabChange,
  tabBadges,
  assistanceEnabled = false,
}: {
  activeTab: ScheduleTabKey;
  onTabChange: (tab: ScheduleTabKey) => void;
  tabBadges?: Partial<Record<ScheduleTabKey, number>>;
  assistanceEnabled?: boolean;
}) {
  const visibleTabs: CrmModuleTabItem<ScheduleTabKey>[] = TABS.filter(
    (tab) => tab.key !== "assistance" || assistanceEnabled
  ).map((tab) => {
    const badge = tabBadges?.[tab.key];
    return {
      key: tab.key,
      label: tab.label,
      count: typeof badge === "number" && badge > 0 ? badge : undefined,
    };
  });

  return (
    <CrmModuleTabs
      tabs={visibleTabs}
      activeKey={activeTab}
      onChange={onTabChange}
      ariaLabel="Schedule sections"
      className="mb-4"
    />
  );
}
