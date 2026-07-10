import { CalendarDays, ClipboardCheck, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendanceTab } from "@/lib/attendance/types";

export function AttendanceHeader({
  branchName,
  nowMs,
  onTabChange,
}: {
  branchName: string;
  nowMs: number;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(nowMs));

  return (
    <header className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-normal text-foreground">Attendance</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manage workforce attendance, service sessions, devices, QR points and recovery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => onTabChange("exceptions")}>
            <Wrench data-icon="inline-start" />
            Recovery Center
          </Button>
          <Button type="button" onClick={() => onTabChange("devices")}>
            <ShieldCheck data-icon="inline-start" />
            Activate Phone
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
        >
          <ClipboardCheck className="size-4" />
          {branchName}
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
        >
          <CalendarDays className="size-4" />
          {today}
        </button>
      </div>
    </header>
  );
}
