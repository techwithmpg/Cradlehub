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
          "border border-[#D4B57A]/45 bg-[#D4B57A]/18 text-[#E5C98B]",
        tone === "available" &&
          "border border-emerald-400/35 bg-emerald-950/60 text-emerald-200",
        tone === "muted" &&
          "border border-[#D4B57A]/22 bg-[#092118] text-[#9FB1A6]",
      )}
    >
      {children}
    </span>
  );
}
