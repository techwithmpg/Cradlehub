import { CircleAlert, LogOut, ScanLine, UserRoundCheck } from "lucide-react";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";

export function AttendanceSummaryCards({ rows }: { rows: AttendanceStaffDiagnostic[] }) {
  const cards = [
    {
      label: "Working",
      detail: "Clocked in or in service",
      count: rows.filter((row) => row.working).length,
      icon: UserRoundCheck,
      className: "bg-emerald-50 text-emerald-800",
    },
    {
      label: "Not in yet",
      detail: "Expected today, including late staff",
      count: rows.filter((row) => row.notScannedIn).length,
      icon: ScanLine,
      className: "bg-amber-50 text-amber-800",
    },
    {
      label: "Needs review",
      detail: "Canonical unresolved incidents",
      count: rows.filter((row) => row.needsHelp).length,
      icon: CircleAlert,
      className: "bg-red-50 text-red-700",
    },
    {
      label: "Checked out",
      detail: "Completed attendance today",
      count: rows.filter((row) => row.checkedOut).length,
      icon: LogOut,
      className: "bg-blue-50 text-blue-700",
    },
  ];
  return (
    <section
      aria-label="Today attendance summary"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-full ${card.className}`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="text-2xl font-bold text-[var(--cs-text)]">{card.count}</div>
                <div className="text-sm font-bold text-[var(--cs-text)]">{card.label}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--cs-text-muted)]">{card.detail}</p>
          </article>
        );
      })}
    </section>
  );
}
