"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MANAGER_SETTINGS_TABS,
  type ManagerSettingsTab,
} from "./types";

export function SettingsTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ManagerSettingsTab;
  onTabChange: (tab: ManagerSettingsTab) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as ManagerSettingsTab)}>
        <TabsList
          variant="line"
          className="h-11 min-w-max justify-start rounded-none border-b border-[var(--cs-border-soft)] p-0"
        >
          {MANAGER_SETTINGS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="h-11 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
