import { AlertTriangle, CheckCircle2, Clock3, Users } from "lucide-react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";

export type TodaySummaryFilterKey = "working" | "not_scanned_in" | "needs_help" | "checked_out";

export function AttendanceSummaryCards({
  rows,
  openReviewCount,
  onSelectCard,
}: {
  rows: AttendanceStaffDiagnostic[];
  openReviewCount?: number;
  onSelectCard?: (key: TodaySummaryFilterKey) => void;
}) {
  const workingCount = rows.filter((row) => row.working).length;
  const notInCount = rows.filter((row) => row.notScannedIn).length;
  const needsReviewCount = openReviewCount ?? rows.filter((row) => row.needsHelp).length;
  const checkedOutCount = rows.filter((row) => row.checkedOut).length;

  const cards: Array<{
    key: TodaySummaryFilterKey;
    label: string;
    detail: string;
    count: number;
    icon: typeof Users;
    tone: CrmCardTone;
  }> = [
    {
      key: "working",
      label: "Working now",
      detail: "Clocked in and on shift",
      count: workingCount,
      icon: Users,
      tone: "success",
    },
    {
      key: "not_scanned_in",
      label: "Not clocked in",
      detail: "Expected today (scheduled staff)",
      count: notInCount,
      icon: Clock3,
      tone: "warning",
    },
    {
      key: "needs_help",
      label: "Needs review",
      detail: "Unclosed shift, missing scan, or conflict",
      count: needsReviewCount,
      icon: AlertTriangle,
      tone: "danger",
    },
    {
      key: "checked_out",
      label: "Checked out",
      detail: "Completed attendance today",
      count: checkedOutCount,
      icon: CheckCircle2,
      tone: "info",
    },
  ];

  return (
    <section
      aria-label="Today attendance summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 @[640px]:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <CrmStatCard
            key={card.key}
            title={card.label}
            value={card.count}
            subtitle={card.detail}
            tone={card.tone}
            icon={<Icon className="size-4.5" aria-hidden="true" />}
            onClick={() => onSelectCard?.(card.key)}
          />
        );
      })}
    </section>
  );
}
