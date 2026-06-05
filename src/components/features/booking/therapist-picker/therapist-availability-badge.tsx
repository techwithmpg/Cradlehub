import { cn } from "@/lib/utils";

type TherapistAvailabilityBadgeProps = {
  children: React.ReactNode;
  tone?: "recommended" | "available" | "muted";
};

export function TherapistAvailabilityBadge({
  children,
  tone = "available",
}: TherapistAvailabilityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide",
        tone === "recommended" && "bg-[#F5E8D1] text-[#9E6C17]",
        tone === "available" && "bg-[#E8F3E8] text-[#2F6B3C]",
        tone === "muted" && "bg-[#F4F0E8] text-[#6B7A6F]"
      )}
    >
      {children}
    </span>
  );
}
