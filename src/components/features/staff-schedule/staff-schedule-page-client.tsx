"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StaffScheduleToolbar } from "./staff-schedule-toolbar";
import { StaffScheduleList, type StaffScheduleItem } from "./staff-schedule-list";
import { StaffScheduleDetailPanel } from "./staff-schedule-detail-panel";
import { PremiumSuccessToast } from "@/components/shared/motion/premium-success-toast";
import { isScheduled } from "@/lib/utils/staff-schedule-summary";
import { getStaffAdminName } from "@/lib/staff/display-name";
import type { ScheduleFilter, ScheduleSort } from "./staff-schedule-toolbar";

type Props = {
  items: StaffScheduleItem[];
};

const TIER_ORDER: Record<string, number> = {
  Senior: 1,
  Mid: 2,
  Junior: 3,
};

export function StaffSchedulePageClient({ items }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ScheduleFilter>("all");
  const [sort, setSort] = useState<ScheduleSort>("name");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [savedStaffName, setSavedStaffName] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => {
        const name = getStaffAdminName(item.staff).toLowerCase();
        const nickname = (item.staff.nickname ?? "").toLowerCase();
        const role = (item.staff.staff_type ?? "").toLowerCase();
        const tier = (item.staff.tier ?? "").toLowerCase();
        return name.includes(q) || nickname.includes(q) || role.includes(q) || tier.includes(q);
      });
    }

    // Filter
    switch (filter) {
      case "scheduled":
        result = result.filter((item) => isScheduled(item.schedules));
        break;
      case "not_scheduled":
        result = result.filter((item) => !isScheduled(item.schedules));
        break;
      case "has_overrides":
        result = result.filter((item) => item.overrides.length > 0);
        break;
      case "has_blocks":
        result = result.filter((item) => item.blockedTimes.length > 0);
        break;
      case "active":
        result = result.filter((item) => item.staff.is_active);
        break;
      case "inactive":
        result = result.filter((item) => !item.staff.is_active);
        break;
    }

    // Sort
    result.sort((a, b) => {
      if (sort === "name") {
        return getStaffAdminName(a.staff).localeCompare(getStaffAdminName(b.staff));
      }
      // tier
      const tierA = TIER_ORDER[a.staff.tier ?? ""] ?? 99;
      const tierB = TIER_ORDER[b.staff.tier ?? ""] ?? 99;
      if (tierA !== tierB) return tierA - tierB;
      return getStaffAdminName(a.staff).localeCompare(getStaffAdminName(b.staff));
    });

    return result;
  }, [items, search, filter, sort]);

  const selectedItem = useMemo(
    () => items.find((item) => item.staff.id === selectedStaffId) ?? null,
    [items, selectedStaffId]
  );

  // Called by editors on successful save — shows a global success toast
  const handleSave = useCallback(() => {
    if (selectedItem) {
      setSavedStaffName(getStaffAdminName(selectedItem.staff));
    }
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 3500);
  }, [selectedItem]);

  return (
    <div>
      <StaffScheduleToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        resultCount={filteredItems.length}
      />

      <StaffScheduleList
        items={filteredItems}
        onManage={(staffId) => setSelectedStaffId(staffId)}
      />

      <StaffScheduleDetailPanel
        staff={selectedItem?.staff ?? null}
        schedules={selectedItem?.schedules ?? []}
        overrides={selectedItem?.overrides ?? []}
        blockedTimes={selectedItem?.blockedTimes ?? []}
        open={selectedStaffId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStaffId(null);
            router.refresh();
          }
        }}
        onSave={handleSave}
      />

      <PremiumSuccessToast
        open={showToast}
        title="Saved"
        description={
          savedStaffName
            ? `Availability updated for ${savedStaffName}.`
            : "Staff availability updated."
        }
        variant="success"
      />
    </div>
  );
}
