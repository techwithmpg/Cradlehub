import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type SpaVisualProps = {
  title: string;
  caption: string;
  className?: string;
  compact?: boolean;
};

export function SpaVisual({ title, caption, className, compact = false }: SpaVisualProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#d6a84f]/35 bg-[linear-gradient(140deg,#f6e3a1_0%,#e7c873_28%,#432c1b_60%,#1f1611_100%)]",
        compact ? "aspect-[16/8]" : "aspect-[5/4]",
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,247,224,0.4),transparent_38%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(120deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_2px,transparent_2px,transparent_14px)] opacity-50" />
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(14,9,6,0.9),rgba(14,9,6,0.2),transparent)] p-4">
        <p className="font-heading text-lg font-semibold text-[#fdf6e3]">{title}</p>
        <p className="mt-1 text-xs text-[#f6e3a1]/90">{caption}</p>
      </div>
      <div className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f6e3a1]/20 text-[#fef7e7] shadow-[0_8px_20px_rgba(16,10,6,0.35)]">
        <Sparkles className="h-4 w-4" />
      </div>
    </div>
  );
}

