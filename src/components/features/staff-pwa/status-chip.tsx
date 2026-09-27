import {
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  Info,
  WifiOff,
} from "lucide-react";
import type { StatusChipVariant } from "./types";
import { cn } from "@/lib/utils";

type StaffStatusChipProps = {
  label: string;
  variant?: StatusChipVariant;
  className?: string;
};

export function StaffStatusChip({
  label,
  variant = "info",
  className,
}: StaffStatusChipProps) {
  let bgClasses = "bg-[#FAF8F5] text-[#1E293B] border-[#EAE4DC]";
  let Icon = Info;

  switch (variant) {
    case "confirmed":
      bgClasses = "bg-[#EEF8F2] text-[#1A4A2A] border-[#D1E7DD]";
      Icon = Check;
      break;
    case "pending":
      bgClasses = "bg-[#FFF4DB] text-[#654600] border-[#FEE199]";
      Icon = Clock;
      break;
    case "stale":
      bgClasses = "bg-[#FFF4DB] text-[#654600] border-[#FEE199]";
      Icon = AlertTriangle;
      break;
    case "offline":
      bgClasses = "bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]";
      Icon = WifiOff;
      break;
    case "blocked":
      bgClasses = "bg-[#FDEBEC] text-[#9B1C20] border-[#F5C2C4]";
      Icon = AlertCircle;
      break;
    case "info":
    default:
      bgClasses = "bg-[#FAF8F5] text-[#1E293B] border-[#EAE4DC]";
      Icon = Info;
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-tight select-none",
        bgClasses,
        className
      )}
    >
      <Icon size={12} className="shrink-0 stroke-[2.5]" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
