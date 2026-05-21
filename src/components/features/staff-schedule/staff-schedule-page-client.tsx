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
import { Users, CalendarCheck, CalendarX, AlertTriangle, ShieldAlert, UserX } from "lucide-react";

type Props = {
  items: StaffScheduleItem[];
};

const TIER_ORDER: Record<string, number> = {
  Senior: 1,
  Mid: 2,
  Junior: 3,
};

// ── Compact stat chip ────────────────────────────────────────────────────────

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--cs-r-sm)",
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--cs-text)",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--cs-text-muted)", marginTop: 2, fontWeight: 500 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function StaffSchedulePageClient({ items }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ScheduleFilter>("all");
  const [sort, setSort] = useState<ScheduleSort>("name");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [savedStaffName, setSavedStaffName] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Summary stats (computed from full list, not filtered)
  const stats = useMemo(() => {
    const total = items.length;
    const scheduledCount = items.filter((i) => isScheduled(i.schedules)).length;
    const notScheduledCount = total - scheduledCount;
    const overridesCount = items.filter((i) => i.overrides.length > 0).length;
    const blocksCount = items.filter((i) => i.blockedTimes.length > 0).length;
    const inactiveCount = items.filter((i) => !i.staff.is_active).length;
    return { total, scheduledCount, notScheduledCount, overridesCount, blocksCount, inactiveCount };
  }, [items]);

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
    <div className="space-y-4">
      {/* Stat strip */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        <StatChip icon={<Users size={15} />} label="Total Staff" value={stats.total} color="var(--cs-sand)" />
        <StatChip
          icon={<CalendarCheck size={15} />}
          label="Scheduled"
          value={stats.scheduledCount}
          color="var(--cs-success)"
        />
        <StatChip
          icon={<CalendarX size={15} />}
          label="Not Scheduled"
          value={stats.notScheduledCount}
          color="var(--cs-warning)"
        />
        <StatChip
          icon={<AlertTriangle size={15} />}
          label="With Overrides"
          value={stats.overridesCount}
          color="var(--cs-info)"
        />
        <StatChip
          icon={<ShieldAlert size={15} />}
          label="With Blocks"
          value={stats.blocksCount}
          color="var(--cs-error)"
        />
        <StatChip
          icon={<UserX size={15} />}
          label="Inactive"
          value={stats.inactiveCount}
          color="var(--cs-neutral)"
        />
      </div>

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
