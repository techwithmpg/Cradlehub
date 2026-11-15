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
        tone === "recommended" &&
          "border border-[#C8A96B]/45 bg-[#F5EFE3] text-[#7D5E29]",
        tone === "available" &&
          "border border-[#163A2B]/20 bg-[#EAF2ED] text-[#163A2B]",
        tone === "muted" &&
          "border border-[#DDD4C2] bg-[#F7F3EB] text-[#6B766F]",
      )}
    >
      {children}
    </span>
  );
}
