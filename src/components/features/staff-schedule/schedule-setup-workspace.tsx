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
import type { StaffScheduleGroup, StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

type TabValue = "general" | "individual" | "overrides" | "coverage";

type Props = {
  items: StaffScheduleItem[];
  groups: StaffScheduleGroup[];
  rulesByGroup: Record<string, StaffGroupScheduleRule[]>;
};

export function ScheduleSetupWorkspace({ items, groups, rulesByGroup }: Props) {
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

  const selectedGroupData = useMemo(() => {
    return groups.find((g) => g.group_key === selectedGroup);
  }, [groups, selectedGroup]);

  const selectedGroupRules = useMemo(() => {
    return rulesByGroup[selectedGroup] ?? [];
  }, [rulesByGroup, selectedGroup]);

  return (
    <div className="space-y-4">
      {/* Compact workflow strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          padding: "6px 10px",
          background: "var(--cs-surface-warm)",
          borderRadius: "var(--cs-r-sm)",
          border: "1px solid var(--cs-border-soft)",
          overflowX: "auto",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--cs-text-secondary)", whiteSpace: "nowrap" }}>Setup Flow:</span>
        {[
          { label: "1. Group Rules", active: activeTab === "general" },
          { label: "2. Individual Adjustments", active: activeTab === "individual" },
          { label: "3. Overrides", active: activeTab === "overrides" },
          { label: "4. Coverage Issues", active: activeTab === "coverage" },
        ].map((step, idx) => (
          <span key={step.label} style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <span
              style={{
                fontWeight: step.active ? 700 : 400,
                color: step.active ? "var(--cs-sand)" : undefined,
              }}
            >
              {step.label}
            </span>
            {idx < 3 && <span style={{ color: "var(--cs-border)" }}>→</span>}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList
          variant="line"
          className="h-10 min-w-max justify-start rounded-none border-b border-[var(--cs-border-soft)] p-0"
        >
          <TabsTrigger
            value="general"
            className="h-10 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            General Rules
          </TabsTrigger>
          <TabsTrigger
            value="individual"
            className="h-10 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            Individual Adjustments
          </TabsTrigger>
          <TabsTrigger
            value="overrides"
            className="h-10 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            Overrides
          </TabsTrigger>
          <TabsTrigger
            value="coverage"
            className="h-10 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
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
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
            <GroupScheduleRulesPanel
              key={selectedGroup}
              selectedGroup={selectedGroup}
              groupData={selectedGroupData}
              groupRules={selectedGroupRules}
            />
            <div className="flex flex-col gap-4">
              <ScheduleSetupRightRail
                selectedGroup={selectedGroup}
                groupItems={groupItems}
                groupRules={selectedGroupRules}
              />
            </div>
          </div>

          <ScheduleSetupHelperBar groupName={groupLabel} />
        </div>
      )}

      {activeTab === "individual" && (
        <StaffSchedulePageClient items={items} rulesByGroup={rulesByGroup} />
      )}

      {activeTab === "overrides" && <ScheduleOverridesView items={items} />}

      {activeTab === "coverage" && <ScheduleCoverageIssues items={items} rulesByGroup={rulesByGroup} />}
    </div>
  );
}
