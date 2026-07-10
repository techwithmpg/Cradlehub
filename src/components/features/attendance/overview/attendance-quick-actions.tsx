import { ClipboardList, FileText, QrCode, ShieldCheck, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab } from "@/lib/attendance/types";

const ACTIONS: Array<{
  label: string;
  detail: string;
  tab: AttendanceTab;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Generate Attendance QR", detail: "Main Branch", tab: "qr", icon: QrCode },
  { label: "Generate Missing QRs", detail: "Rooms", tab: "qr", icon: QrCode },
  { label: "Activate Staff Phone", detail: "Register device", tab: "devices", icon: ShieldCheck },
  { label: "View Attendance Records", detail: "Today", tab: "records", icon: ClipboardList },
  { label: "Open Recovery", detail: "Rules and fixes", tab: "exceptions", icon: Wrench },
  { label: "Open Reports", detail: "Exportable", tab: "reports", icon: FileText },
];

export function AttendanceQuickActions({ onTabChange }: { onTabChange: (tab: AttendanceTab) => void }) {
  return (
    <Panel title="Quick Actions">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={`${action.label}-${action.tab}`}
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 px-3 py-3 text-left"
              onClick={() => onTabChange(action.tab)}
            >
              <Icon data-icon="inline-start" />
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">{action.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{action.detail}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </Panel>
  );
}
