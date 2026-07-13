"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ScheduleValidationIssue } from "./adjust-schedule-types";

type ScheduleImpactSummaryProps = {
  dirty: boolean;
  issues: ScheduleValidationIssue[];
};

function ImpactRow({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "info" }) {
  const Icon = tone === "good" ? CheckCircle2 : tone === "warn" ? AlertCircle : Info;
  const color = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-800" : "text-[#615c52]";
  return (
    <li className="flex items-start justify-between gap-3 text-xs">
      <span className="flex items-center gap-2 text-[#3f3a32]">
        <Icon className={`size-3.5 ${color}`} />
        {label}
      </span>
      <span className={`text-right font-semibold ${color}`}>{value}</span>
    </li>
  );
}

export function ScheduleImpactSummary({ dirty, issues }: ScheduleImpactSummaryProps) {
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;

  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-[#181713]">Impact Summary</p>
      <ul className="mt-4 space-y-4">
        <ImpactRow
          label="Coverage impact"
          value={dirty ? "Review required" : "No draft change"}
          tone={dirty ? "warn" : "good"}
        />
        <ImpactRow
          label="Booking availability"
          value={dirty ? "May change" : "Unchanged"}
          tone={dirty ? "warn" : "good"}
        />
        <ImpactRow
          label="Attendance impact"
          value={dirty ? "Window changed" : "Unchanged"}
          tone={dirty ? "info" : "good"}
        />
        <ImpactRow
          label="Dispatch impact"
          value={dirty ? "Review required" : "Unchanged"}
          tone={dirty ? "info" : "good"}
        />
        <ImpactRow
          label="Conflicts"
          value={errors > 0 ? `${errors} blocking` : warnings > 0 ? `${warnings} warning` : "No blocking conflicts"}
          tone={errors > 0 || warnings > 0 ? "warn" : "good"}
        />
      </ul>
      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[0.7rem] leading-5 text-amber-900">
        Existing bookings are never changed by this adjustment. Review operational bookings before saving schedule changes.
      </p>
    </section>
  );
}
