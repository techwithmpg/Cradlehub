import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ManagerSettingsWarning } from "./types";

export function SettingsWarningCard({
  warning,
  onClick,
}: {
  warning: ManagerSettingsWarning;
  onClick?: () => void;
}) {
  const critical = warning.severity === "critical";

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--cs-r-md)] border p-3 text-left transition hover:bg-[var(--cs-surface-warm)]",
        critical
          ? "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]"
          : "border-[var(--cs-border-soft)] bg-[var(--cs-surface)] text-[var(--cs-warning-text)]"
      )}
      onClick={onClick}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{warning.title}</span>
        <span className="mt-1 block text-xs leading-5 opacity-80">
          {warning.description}
        </span>
      </span>
      <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden="true" />
    </button>
  );
}
