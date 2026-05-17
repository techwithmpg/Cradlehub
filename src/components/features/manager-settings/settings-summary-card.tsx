import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsSummaryCard({
  icon: Icon,
  title,
  badge,
  children,
  actionLabel,
  onAction,
  className,
}: {
  icon: LucideIcon;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-[var(--cs-r-lg)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-[var(--cs-shadow-xs)] ring-0",
        className
      )}
    >
      <CardContent className="flex h-full flex-col gap-4 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--cs-r-md)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--cs-text)]">
                {title}
              </h2>
            </div>
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>

        <div className="min-h-20 flex-1 space-y-2 text-sm text-[var(--cs-text-secondary)]">
          {children}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-auto w-fit border-[var(--cs-border)] text-[var(--cs-sand-dark)] hover:bg-[var(--cs-sand-tint)]"
          onClick={onAction}
        >
          {actionLabel}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}
