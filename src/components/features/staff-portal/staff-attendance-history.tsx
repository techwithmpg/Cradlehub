import { AlertCircle, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  StaffAttendanceData,
  StaffAttendanceHistoryRecord,
} from "@/lib/staff-portal/attendance";

function time(value: string | null, timezone: string): string {
  return value
    ? new Date(value).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      })
    : "—";
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
}

function metricSummary(record: StaffAttendanceHistoryRecord): string {
  const metrics = [
    record.lateMinutes > 0 ? `${record.lateMinutes}m late` : null,
    record.earlyLeaveMinutes > 0 ? `${record.earlyLeaveMinutes}m early` : null,
    record.overtimeMinutes > 0 ? `${record.overtimeMinutes}m overtime` : null,
  ].filter(Boolean);
  return metrics.join(" · ") || "On record";
}

export function StaffAttendanceHistory({ data }: { data: StaffAttendanceData }) {
  const today = data.currentRecord;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock3 className="size-5 text-primary" /> Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Schedule
              </p>
              <p className="mt-1 font-medium">{data.scheduleLabel}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current state
              </p>
              <p className="mt-1 font-medium">{data.todayState.displayLabel}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Times
              </p>
              <p className="mt-1 font-medium">
                {time(today?.checkedInAt ?? null, data.todayState.timezone)} –{" "}
                {time(today?.checkedOutAt ?? null, data.todayState.timezone)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Review
              </p>
              <p
                className={`mt-1 font-medium ${data.todayState.actionRequired ? "text-amber-700" : ""}`}
              >
                {data.todayState.actionRequired
                  ? (data.issues[0]?.title ?? "Attendance needs confirmation")
                  : (today?.reviewLabel ?? "No review needed")}
              </p>
            </div>
          </div>
          {today ? (
            <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Worked {duration(today.workedMinutes)} · {metricSummary(today)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="size-5 text-primary" /> Attendance history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No attendance records in the last 90 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock times</TableHead>
                    <TableHead>Worked</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <span className="font-medium">
                          {new Date(`${record.shiftDate}T00:00:00`).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {record.shiftType.replaceAll("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        {time(record.checkedInAt, data.todayState.timezone)} –{" "}
                        {time(record.checkedOutAt, data.todayState.timezone)}
                      </TableCell>
                      <TableCell>{duration(record.workedMinutes)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {metricSummary(record)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={record.reviewState === "review" ? "outline" : "secondary"}
                          className={
                            record.reviewState === "review" ? "gap-1 text-amber-700" : "gap-1"
                          }
                        >
                          {record.reviewState === "review" ? (
                            <AlertCircle className="size-3.5" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          {record.reviewLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
