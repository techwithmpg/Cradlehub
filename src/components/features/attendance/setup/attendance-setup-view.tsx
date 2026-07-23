"use client";

import { AttendancePhonesSetup } from "@/components/features/attendance/setup/attendance-phones-setup";
import { AttendanceQrSetup } from "@/components/features/attendance/setup/attendance-qr-setup";
import { AttendanceRulesSetup } from "@/components/features/attendance/setup/attendance-rules-setup";
import type { AttendanceSetupSection } from "@/lib/attendance/crm-navigation";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

const SECTIONS: Array<{ key: AttendanceSetupSection; label: string }> = [
  { key: "qr", label: "QR codes" },
  { key: "phones", label: "Staff phones" },
  { key: "rules", label: "Rules" },
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
      <div className="inline-flex w-fit rounded-lg border border-[var(--cs-border)] bg-white p-1">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSectionChange(item.key)}
            className={cn(
              "rounded-md px-3 py-2 text-xs font-bold",
              section === item.key
                ? "bg-[#2A5A3A] text-white"
                : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
            )}
          >
            {item.label}
          </button>
        ))}
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
