"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleGroupCards, STAFF_GROUPS } from "./schedule-group-cards";
import { GroupScheduleRulesPanel } from "./group-schedule-rules-panel";
import { ScheduleSetupRightRail } from "./schedule-setup-right-rail";
import { ScheduleCoverageIssues } from "./schedule-coverage-issues";
import { ScheduleOverridesView } from "./schedule-overrides-view";
import { ScheduleSetupHelperBar } from "./schedule-setup-helper-bar";
import { StaffSchedulePageClient } from "./staff-schedule-page-client";
import type { StaffScheduleItem } from "./staff-schedule-list";

type TabValue = "general" | "individual" | "overrides" | "coverage";

type Props = {
  items: StaffScheduleItem[];
};

export function ScheduleSetupWorkspace({ items }: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("general");
  const [selectedGroup, setSelectedGroup] = useState<string>("therapist");

  const groupItems = useMemo(() => {
    const group = STAFF_GROUPS.find((g) => g.id === selectedGroup);
    if (!group) return [];
    return items.filter((i) => group.staffTypes.includes(i.staff.staff_type ?? ""));
  }, [items, selectedGroup]);

  const groupLabel = useMemo(() => {
    return STAFF_GROUPS.find((g) => g.id === selectedGroup)?.label ?? selectedGroup;
  }, [selectedGroup]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList
          variant="line"
          className="h-11 min-w-max justify-start rounded-none border-b border-[var(--cs-border-soft)] p-0"
        >
          <TabsTrigger
            value="general"
            className="h-11 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            General Rules
          </TabsTrigger>
          <TabsTrigger
            value="individual"
            className="h-11 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            Individual Adjustments
          </TabsTrigger>
          <TabsTrigger
            value="overrides"
            className="h-11 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            Overrides
          </TabsTrigger>
          <TabsTrigger
            value="coverage"
            className="h-11 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            Coverage Issues
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab content */}
      {activeTab === "general" && (
        <div className="flex flex-col gap-4">
          <ScheduleGroupCards
            items={items}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <GroupScheduleRulesPanel
              selectedGroup={selectedGroup}
              groupItems={groupItems}
            />
            <div className="flex flex-col gap-4">
              <ScheduleSetupRightRail
                selectedGroup={selectedGroup}
                groupItems={groupItems}
              />
            </div>
          </div>

          <ScheduleSetupHelperBar groupName={groupLabel} />
        </div>
      )}

      {activeTab === "individual" && <StaffSchedulePageClient items={items} />}

      {activeTab === "overrides" && <ScheduleOverridesView items={items} />}

      {activeTab === "coverage" && <ScheduleCoverageIssues items={items} />}
    </div>
  );
}
