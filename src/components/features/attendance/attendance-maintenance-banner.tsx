import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type AttendanceMaintenanceBannerProps = {
  message: string;
  title?: string;
  className?: string;
};

export function AttendanceMaintenanceBanner({
  message,
  title = "Attendance maintenance",
  className,
}: AttendanceMaintenanceBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950",
        className
      )}
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm leading-6">{message}</p>
      </div>
    </div>
  );
}
