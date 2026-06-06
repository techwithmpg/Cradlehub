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
        tone === "recommended" && "border border-[#D4B57A]/30 bg-[#D4B57A]/14 text-[#D4B57A]",
        tone === "available" && "border border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
        tone === "muted" && "border border-[#D4B57A]/18 bg-[#05241D]/50 text-[#F6EBD6]/62"
      )}
    >
      {children}
    </span>
  );
}
