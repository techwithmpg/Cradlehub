import type { ComponentType } from "react";
import { BriefcaseBusiness, CarFront, Leaf, ShieldCheck, Sparkles, UserRound, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffScheduleGroup } from "@/lib/queries/staff-schedule-groups";
import { getGroupScheduleConfig } from "./schedule-rule-builder-utils";

export type StaffGroupDef = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  staffTypes: string[];
};

export const STAFF_GROUPS: StaffGroupDef[] = [
  { id: "therapist", label: "Therapists", icon: UserRound, staffTypes: ["therapist"] },
  { id: "csr", label: "CRM / Front Desk", icon: BriefcaseBusiness, staffTypes: ["csr"] },
  { id: "driver", label: "Drivers", icon: CarFront, staffTypes: ["driver"] },
  { id: "utility", label: "Utility", icon: Wrench, staffTypes: ["utility"] },
  { id: "nail_tech", label: "Salon / Nail Tech", icon: Sparkles, staffTypes: ["nail_tech", "salon_head"] },
  { id: "aesthetician", label: "Aesthetician", icon: Leaf, staffTypes: ["aesthetician", "facialist"] },
  { id: "managerial", label: "Managers", icon: ShieldCheck, staffTypes: ["managerial"] },
];

export function getGroupLabel(groupId: string): string {
  return getGroupScheduleConfig(groupId).label;
}

type Props = {
  items: StaffScheduleItem[];
  groups: StaffScheduleGroup[];
  selectedGroup: string;
  onSelectGroup: (groupId: string) => void;
};

export function ScheduleGroupCards({ items, groups, selectedGroup, onSelectGroup }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {STAFF_GROUPS.map((group) => {
        const Icon = group.icon;
        const count = items.filter((item) =>
          group.staffTypes.includes(item.staff.staff_type ?? "")
        ).length;
        const isActive = selectedGroup === group.id;
        const hasGroupData = groups.some((row) => row.group_key === group.id);

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(group.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition",
              isActive
                ? "border-emerald-700 bg-emerald-50 text-emerald-950 shadow-sm"
                : "border-stone-200 bg-white/80 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
            )}
            aria-pressed={isActive}
          >
            <Icon className={cn("size-4", isActive ? "text-emerald-800" : "text-stone-500")} />
            <span>{group.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                isActive ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-500"
              )}
            >
              {count}
            </span>
            {!hasGroupData && count > 0 ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                No rules
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
