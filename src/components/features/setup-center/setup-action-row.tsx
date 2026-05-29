import Link from "next/link";
import { cn } from "@/lib/utils";

export function SetupActionRow({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  severity = "warning",
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  severity?: "critical" | "warning" | "info";
}) {
  const styles =
    severity === "critical"
      ? {
          border: "border-red-200",
          bg: "bg-red-50/80",
          iconBg: "bg-red-100",
          btn: "border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300",
        }
      : severity === "warning"
        ? {
            border: "border-amber-200",
            bg: "bg-amber-50/80",
            iconBg: "bg-amber-100",
            btn: "border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300",
          }
        : {
            border: "border-[var(--cs-border-soft)]",
            bg: "bg-[var(--cs-surface)]",
            iconBg: "bg-[var(--cs-surface-warm)]",
            btn: "border-[var(--cs-border-soft)] text-[var(--cs-sand)] hover:bg-[var(--cs-sand-mist)] hover:border-[var(--cs-sand)]",
          };

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border p-4 transition-all hover:shadow-sm sm:flex-row sm:items-center sm:gap-4",
        styles.border,
        styles.bg
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base",
          styles.iconBg
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--cs-text)]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
          {description}
        </p>
      </div>
      <Link
        href={actionHref}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 self-start rounded-lg border bg-white px-3.5 py-2 text-xs font-semibold transition-all sm:self-center",
          styles.btn
        )}
      >
        {actionLabel} ›
      </Link>
    </div>
  );
}
