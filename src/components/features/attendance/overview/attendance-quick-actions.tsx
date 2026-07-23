import Link from "next/link";
import { CalendarPlus, ClipboardEdit, Lightbulb, QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab } from "@/lib/attendance/types";

export function AttendanceQuickActions({
  onTabChange,
}: {
  onTabChange: (tab: AttendanceTab) => void;
}) {
  return (
    <Panel title="Quick actions" description="Common attendance tasks">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <Button
          asChild
          variant="outline"
          className="h-auto justify-start gap-3 border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-3 text-left"
        >
          <Link href="/crm/schedule?tab=setup">
            <CalendarPlus className="size-4 text-[var(--cs-crm-text)]" />
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">Add staff schedule</span>
              <span className="text-xs font-normal text-[var(--cs-text-muted)]">
                Open schedule setup
              </span>
            </span>
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => onTabChange("exceptions")}
          className="h-auto justify-start gap-3 border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-3 text-left"
        >
          <ClipboardEdit className="size-4 text-[var(--cs-crm-text)]" />
          <span className="grid gap-0.5">
            <span className="text-sm font-semibold">Manual correction</span>
            <span className="text-xs font-normal text-[var(--cs-text-muted)]">
              Repair a staff day
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => onTabChange("devices")}
          className="h-auto justify-start gap-3 border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-3 text-left"
        >
          <Smartphone className="size-4 text-[var(--cs-crm-text)]" />
          <span className="grid gap-0.5">
            <span className="text-sm font-semibold">Register phone</span>
            <span className="text-xs font-normal text-[var(--cs-text-muted)]">
              Activate or recover a device
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => onTabChange("qr")}
          className="h-auto justify-start gap-3 border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-3 text-left"
        >
          <QrCode className="size-4 text-[var(--cs-crm-text)]" />
          <span className="grid gap-0.5">
            <span className="text-sm font-semibold">Generate QR code</span>
            <span className="text-xs font-normal text-[var(--cs-text-muted)]">
              Print attendance or room QR
            </span>
          </span>
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-[var(--cs-r-md)] bg-[var(--cs-crm-bg)] p-3 text-xs text-[var(--cs-crm-text)]">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <p className="m-0">
          Keep schedules accurate. Most review items can be prevented when today&apos;s branch and
          shift are already correct.
        </p>
      </div>
    </Panel>
  );
}
