import { cn } from "@/lib/utils";

export type CrmStatusVariant =
  | "active"
  | "repeat"
  | "lapsed"
  | "new"
  | "vip"
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "available"
  | "busy"
  | "offline"
  | "warning"
  | "info"
  | "neutral"
  | "gold";

type CrmStatusBadgeProps = {
  variant: CrmStatusVariant;
  /** Override the auto-derived label */
  label?: string;
  size?: "sm" | "md";
  /** Show a status dot (pulsing for active/available) */
  dot?: boolean;
  className?: string;
};

type VariantConfig = {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  pulse?: boolean;
};

const VARIANT_CONFIG: Record<CrmStatusVariant, VariantConfig> = {
  active:    { label: "Active",    bgClass: "bg-[var(--cs-success-bg)]",  textClass: "text-[var(--cs-success-text)]",  dotClass: "bg-[var(--cs-success)]",  pulse: true },
  repeat:    { label: "Repeat",    bgClass: "bg-[var(--cs-sand-mist)]",   textClass: "text-[var(--cs-sand)]",          dotClass: "bg-[var(--cs-sand)]" },
  lapsed:    { label: "Lapsed",    bgClass: "bg-[var(--cs-warning-bg)]",  textClass: "text-[var(--cs-warning-text)]",  dotClass: "bg-[var(--cs-warning)]" },
  new:       { label: "New",       bgClass: "bg-[var(--cs-success-bg)]",  textClass: "text-[var(--cs-success-text)]",  dotClass: "bg-[var(--cs-success)]" },
  vip:       { label: "VIP",       bgClass: "bg-[var(--cs-sand-mist)]",   textClass: "text-[var(--cs-sand-dark)]",     dotClass: "bg-[var(--cs-sand-dark)]" },
  pending:   { label: "Pending",   bgClass: "bg-[var(--cs-info-bg)]",     textClass: "text-[var(--cs-info-text)]",     dotClass: "bg-[var(--cs-info)]" },
  confirmed: { label: "Confirmed", bgClass: "bg-[var(--cs-success-bg)]",  textClass: "text-[var(--cs-success-text)]",  dotClass: "bg-[var(--cs-success)]" },
  completed: { label: "Completed", bgClass: "bg-[var(--cs-success-bg)]",  textClass: "text-[var(--cs-success-text)]",  dotClass: "bg-[var(--cs-success)]" },
  cancelled: { label: "Cancelled", bgClass: "bg-[var(--cs-error-bg)]",    textClass: "text-[var(--cs-error-text)]",    dotClass: "bg-[var(--cs-error)]" },
  no_show:   { label: "No Show",   bgClass: "bg-[var(--cs-error-bg)]",    textClass: "text-[var(--cs-error-text)]",    dotClass: "bg-[var(--cs-error)]" },
  available: { label: "Available", bgClass: "bg-[var(--cs-success-bg)]",  textClass: "text-[var(--cs-success-text)]",  dotClass: "bg-[var(--cs-success)]", pulse: true },
  busy:      { label: "Busy",      bgClass: "bg-[var(--cs-warning-bg)]",  textClass: "text-[var(--cs-warning-text)]",  dotClass: "bg-[var(--cs-warning)]" },
  offline:   { label: "Offline",   bgClass: "bg-[var(--cs-neutral-bg)]",  textClass: "text-[var(--cs-neutral-text)]",  dotClass: "bg-[var(--cs-neutral)]" },
  warning:   { label: "Warning",   bgClass: "bg-[var(--cs-warning-bg)]",  textClass: "text-[var(--cs-warning-text)]",  dotClass: "bg-[var(--cs-warning)]" },
  info:      { label: "Info",      bgClass: "bg-[var(--cs-info-bg)]",     textClass: "text-[var(--cs-info-text)]",     dotClass: "bg-[var(--cs-info)]" },
  neutral:   { label: "Neutral",   bgClass: "bg-[var(--cs-neutral-bg)]",  textClass: "text-[var(--cs-neutral-text)]",  dotClass: "bg-[var(--cs-neutral)]" },
  gold:      { label: "Gold",      bgClass: "bg-[var(--cs-sand-mist)]",   textClass: "text-[var(--cs-sand)]",          dotClass: "bg-[var(--cs-sand)]" },
};

/**
 * Unified CRM status badge system.
 * Uses .cs-badge base class + CSS variable colour pairs.
 * Optional dot/pulse for live-status variants (active, available).
 */
export function CrmStatusBadge({
  variant,
  label,
  size = "md",
  dot,
  className,
}: CrmStatusBadgeProps) {
  const config = VARIANT_CONFIG[variant];
  const displayLabel = label ?? config.label;
  const showPulse = dot === true && config.pulse === true;

  return (
    <span
      className={cn(
        "cs-badge inline-flex items-center gap-1",
        config.bgClass,
        config.textClass,
        size === "sm" && "px-1.5 py-0 text-[10px]",
        className
      )}
    >
      {dot && (
        <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
          {showPulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                config.dotClass
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              config.dotClass
            )}
          />
        </span>
      )}
      {displayLabel}
    </span>
  );
}
