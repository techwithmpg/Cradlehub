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
import { StaffScheduleCard } from "./staff-schedule-card";
import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffScheduleGroup, StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

type TabValue = "general" | "individual" | "overrides" | "coverage" | "staff-schedule";

type Props = {
  items: StaffScheduleItem[];
  groups: StaffScheduleGroup[];
  rulesByGroup: Record<string, StaffGroupScheduleRule[]>;
  branchId: string;
};

export function ScheduleSetupWorkspace({ items, groups, rulesByGroup, branchId }: Props) {
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* Setup flow breadcrumb — subtle and compact */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          fontSize: "0.6875rem",
          color: "var(--cs-text-muted)",
          padding: "5px 12px",
          background: "var(--cs-surface-warm)",
          borderRadius: "var(--cs-r-lg)",
          border: "1px solid var(--cs-border-soft)",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--cs-text-secondary)", whiteSpace: "nowrap", marginRight: 4 }}>
          Setup Flow
        </span>
        {[
          { label: "Group Rules", tab: "general" as TabValue },
          { label: "Individual", tab: "individual" as TabValue },
          { label: "Overrides", tab: "overrides" as TabValue },
          { label: "Coverage", tab: "coverage" as TabValue },
          { label: "Staff Schedule", tab: "staff-schedule" as TabValue },
        ].map((step, idx) => (
          <span
            key={step.label}
            style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
          >
            <button
              type="button"
              onClick={() => setActiveTab(step.tab)}
              style={{
                fontWeight: activeTab === step.tab ? 700 : 400,
                color: activeTab === step.tab ? "var(--cs-crm-accent)" : "inherit",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                borderRadius: "var(--cs-r-sm)",
                transition: "color 120ms ease",
                fontSize: "inherit",
              }}
            >
              {step.label}
            </button>
            {idx < 4 && <span style={{ color: "var(--cs-border)", opacity: 0.6 }}>/</span>}
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
          <TabsTrigger
            value="staff-schedule"
            className="h-10 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[var(--cs-sand)] data-active:text-[var(--cs-sand-dark)]"
          >
            Staff Schedule
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab content */}
      {activeTab === "general" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <ScheduleGroupCards
            items={items}
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
          />

          <div
            style={{ display: "grid", gap: "1.25rem", alignItems: "start" }}
            className="grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]"
          >
            <GroupScheduleRulesPanel
              key={selectedGroup}
              selectedGroup={selectedGroup}
              groupData={selectedGroupData}
              groupRules={selectedGroupRules}
            />
            <aside style={{ display: "flex", flexDirection: "column", gap: "0.875rem", minWidth: 0 }}>
              <ScheduleSetupRightRail
                selectedGroup={selectedGroup}
                groupItems={groupItems}
                groupRules={selectedGroupRules}
              />
            </aside>
          </div>

          <ScheduleSetupHelperBar groupName={groupLabel} />
        </div>
      )}

      {activeTab === "individual" && (
        <StaffSchedulePageClient items={items} rulesByGroup={rulesByGroup} />
      )}

      {activeTab === "overrides" && <ScheduleOverridesView items={items} />}

      {activeTab === "coverage" && (
        <ScheduleCoverageIssues items={items} rulesByGroup={rulesByGroup} />
      )}

      {activeTab === "staff-schedule" && (
        <StaffScheduleCard
          items={items}
          rulesByGroup={rulesByGroup}
          branchId={branchId}
        />
      )}
    </div>
  );
}
