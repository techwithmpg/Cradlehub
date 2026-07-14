import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";

function clockLabel(state: StaffAttendanceData["currentClockState"]): string {
  if (state === "clocked_in") return "Clocked in";
  if (state === "clocked_out") return "Clocked out";
  return "Not clocked in";
}

export function StaffAttendanceSummary({ data }: { data: StaffAttendanceData }) {
  const record = data.currentRecord;
  return (
    <section className="mb-4 rounded-2xl border bg-card p-4 shadow-sm" aria-labelledby="my-attendance-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="my-attendance-summary-title" className="flex items-center gap-2 font-semibold">
            <CalendarClock className="size-5 text-primary" /> My attendance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{data.scheduleLabel} · {data.todayState.displayLabel}</p>
        </div>
        <Badge variant={data.currentClockState === "clocked_in" ? "default" : "secondary"} className="gap-1">
          {data.currentClockState === "clocked_in" ? <Clock3 className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {clockLabel(data.currentClockState)}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span><span className="text-muted-foreground">Latest in:</span> {record ? new Date(record.checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: data.todayState.timezone }) : "—"}</span>
        <span><span className="text-muted-foreground">Latest out:</span> {record?.checkedOutAt ? new Date(record.checkedOutAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: data.todayState.timezone }) : "—"}</span>
        <span className={record?.reviewState === "review" ? "text-amber-700" : "text-muted-foreground"}>{record?.reviewLabel ?? (data.scheduleState === "day_off" ? "No review needed" : "No attendance recorded yet")}</span>
        <Link href="/staff-portal/attendance" className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
          View history <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
