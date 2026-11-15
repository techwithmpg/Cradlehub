"use client";

import { QrCode, SlidersHorizontal, Smartphone } from "lucide-react";
import { AttendancePhonesSetup } from "@/components/features/attendance/setup/attendance-phones-setup";
import { AttendanceQrSetup } from "@/components/features/attendance/setup/attendance-qr-setup";
import { AttendanceRulesSetup } from "@/components/features/attendance/setup/attendance-rules-setup";
import type { AttendanceSetupSection } from "@/lib/attendance/crm-navigation";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

const SECTIONS: Array<{
  key: AttendanceSetupSection;
  label: string;
  icon: typeof QrCode;
}> = [
  { key: "qr", label: "QR Codes", icon: QrCode },
  { key: "phones", label: "Staff Phones", icon: Smartphone },
  { key: "rules", label: "Rules", icon: SlidersHorizontal },
];

export function AttendanceSetupView({
  data,
  section,
  initialStaffId,
  onSectionChange,
  onRefresh,
}: {
  data: AttendanceWorkspaceData;
  section: AttendanceSetupSection;
  initialStaffId?: string | null;
  onSectionChange: (section: AttendanceSetupSection) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label="Attendance setup sections"
        className="inline-flex w-fit flex-wrap items-center gap-1 rounded-xl border border-[var(--cs-border-soft)] bg-white p-1 shadow-2xs"
      >
        {SECTIONS.map((item) => {
          const active = section === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSectionChange(item.key)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E33]",
                active
                  ? "bg-[#1F4E33] text-white shadow-2xs"
                  : "text-[var(--cs-text-secondary)] hover:bg-[#FAF8F5] hover:text-[var(--cs-text)]"
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {section === "qr" ? (
        <AttendanceQrSetup data={data} onRefresh={onRefresh} />
      ) : section === "phones" ? (
        <AttendancePhonesSetup data={data} initialStaffId={initialStaffId} onRefresh={onRefresh} />
      ) : (
        <AttendanceRulesSetup data={data} onRefresh={onRefresh} />
      )}
    </div>
  );
}
