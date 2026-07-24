import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffAttendancePhoneState } from "@/lib/attendance/device-registration";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";

function CheckRow({
  icon: Icon,
  label,
  value,
  ready,
}: {
  icon: typeof Smartphone;
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3">
      <span
        className={
          ready
            ? "flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"
            : "flex size-9 items-center justify-center rounded-full bg-amber-50 text-amber-700"
        }
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
      {ready ? (
        <CheckCircle2 className="size-5 text-emerald-600" aria-label="Ready" />
      ) : (
        <AlertTriangle className="size-5 text-amber-600" aria-label="Needs attention" />
      )}
    </div>
  );
}

export function AttendanceReadinessCard({
  data,
  phoneState,
}: {
  data: StaffAttendanceData;
  phoneState: StaffAttendancePhoneState | null;
}) {
  const phoneReady = Boolean(phoneState?.registeredDevice);
  const branchIssue = data.issues.some((issue) => issue.kind === "branch");
  const scheduleReady = data.scheduleState === "scheduled" || data.scheduleState === "day_off";
  const unresolvedCount = data.issues.length;
  const ready = phoneReady && !branchIssue && scheduleReady && unresolvedCount === 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="size-5 text-primary" />
              Attendance readiness
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              The system checks your account, this phone, branch, schedule, and open Attendance
              questions.
            </p>
          </div>
          <Badge
            variant={ready ? "secondary" : "outline"}
            className={ready ? "text-emerald-700" : "text-amber-700"}
          >
            {ready ? "Ready to scan" : "Action needed"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckRow
            icon={CircleUserRound}
            label="Staff account"
            value={`${data.staffName} is signed in`}
            ready
          />
          <CheckRow
            icon={Smartphone}
            label="This phone"
            value={
              phoneReady ? (phoneState?.registeredDevice?.label ?? "Connected") : "Not connected"
            }
            ready={phoneReady}
          />
          <CheckRow
            icon={Building2}
            label="Branch"
            value={branchIssue ? "Confirmation required" : "Profile branch confirmed"}
            ready={!branchIssue}
          />
          <CheckRow
            icon={CalendarClock}
            label="Today’s schedule"
            value={data.scheduleLabel}
            ready={scheduleReady}
          />
        </div>

        {!phoneReady ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Connect this phone before scanning</p>
            <p className="mt-1 leading-6">
              Open the branch Attendance QR on this phone. When the sign-in page appears, sign in
              with your own staff account. The system will connect this phone and finish the scan
              automatically.
            </p>
            <p className="mt-2 font-medium">Scan only once. Do not refresh or scan repeatedly.</p>
            <Button asChild className="mt-3" size="sm">
              <Link href="/staff-portal/profile#attendance-phone">
                Open phone instructions
                <ChevronRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        ) : null}

        {data.issues.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Attendance actions for you</p>
            {data.issues.slice(0, 4).map((issue) => (
              <div
                key={issue.id}
                className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center"
              >
                <AlertTriangle className="size-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-950">{issue.title}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{issue.guidance}</p>
                  {issue.waitingForCrm ? (
                    <p className="mt-1 text-xs font-semibold text-amber-800">
                      Waiting for CRM’s final approval.
                    </p>
                  ) : null}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={issue.actionHref}>{issue.actionLabel}</Link>
                </Button>
              </div>
            ))}
          </div>
        ) : ready ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-bold">Attendance is ready</p>
            <p className="mt-1">Use this phone and scan the branch Attendance QR once.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
