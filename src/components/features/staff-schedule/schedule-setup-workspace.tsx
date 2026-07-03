"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleGroupCards, STAFF_GROUPS } from "./schedule-group-cards";
import { GroupScheduleRulesPanel } from "./group-schedule-rules-panel";
import { ScheduleSetupRightRail } from "./schedule-setup-right-rail";
import { ScheduleCoverageIssues } from "./schedule-coverage-issues";
import { ScheduleOverridesView } from "./schedule-overrides-view";
import { ScheduleSetupHelperBar } from "./schedule-setup-helper-bar";
import { IndividualScheduleEditor } from "./individual-schedule-editor";
import { StaffScheduleCard } from "./staff-schedule-card";
import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffScheduleGroup, StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";

type TabValue = "general" | "individual" | "overrides" | "coverage" | "staff-schedule";

type Props = {
  items: StaffScheduleItem[];
  groups: StaffScheduleGroup[];
  rulesByGroup: Record<string, StaffGroupScheduleRule[]>;
  branchId: string;
  onDataRefresh?: () => void;
};

function parseTab(value: string | null): TabValue {
  if (
    value === "general" ||
    value === "individual" ||
    value === "overrides" ||
    value === "coverage" ||
    value === "staff-schedule"
  ) {
    return value;
  }

  return "general";
}

export function ScheduleSetupWorkspace({ items, groups, rulesByGroup, branchId, onDataRefresh }: Props) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>(() => parseTab(searchParams.get("tab")));
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

  function handleTabChange(tab: TabValue) {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "general") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }

    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  return (
    <div className="space-y-5 rounded-3xl bg-[#f8f4ee] p-4 md:p-5">
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white/70 px-3 py-2 text-xs text-stone-500">
        <span className="mr-1 shrink-0 font-bold text-stone-700">Setup Flow</span>
        {[
          { label: "Group Rules", tab: "general" as TabValue },
          { label: "Individual", tab: "individual" as TabValue },
          { label: "Overrides", tab: "overrides" as TabValue },
          { label: "Coverage", tab: "coverage" as TabValue },
          { label: "Staff Schedule", tab: "staff-schedule" as TabValue },
        ].map((step, index) => (
          <span key={step.label} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange(step.tab)}
              className={
                activeTab === step.tab
                  ? "rounded-lg px-2 py-1 font-black text-emerald-900"
                  : "rounded-lg px-2 py-1 font-semibold hover:bg-stone-100"
              }
            >
              {step.label}
            </button>
            {index < 4 ? <span className="text-stone-300">/</span> : null}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as TabValue)}>
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
        <div className="space-y-5">
          <ScheduleGroupCards
            items={items}
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
          />

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <GroupScheduleRulesPanel
              key={selectedGroup}
              selectedGroup={selectedGroup}
              groupData={selectedGroupData}
              groupRules={selectedGroupRules}
              staffCount={groupItems.length}
              onDataRefresh={onDataRefresh}
            />
            <aside className="min-w-0">
              <ScheduleSetupRightRail
                selectedGroup={selectedGroup}
                groupItems={groupItems}
                groupRules={selectedGroupRules}
                onSelectTab={handleTabChange}
              />
            </aside>
          </div>

          <ScheduleSetupHelperBar groupName={groupLabel} />
        </div>
      )}

      {activeTab === "individual" && (
        <IndividualScheduleEditor
          branchId={branchId}
          branchName="Assigned branch"
          items={items}
          rulesByGroup={rulesByGroup}
          onBackToGeneral={() => handleTabChange("general")}
          onDataRefresh={onDataRefresh}
        />
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
          onDataRefresh={onDataRefresh}
        />
      )}
    </div>
  );
}
