import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsSectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-[var(--cs-r-lg)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-[var(--cs-shadow-xs)] ring-0",
        className
      )}
    >
      <CardHeader className="border-b border-[var(--cs-border-soft)] px-4 py-4">
        <CardTitle className="text-base font-semibold text-[var(--cs-text)]">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="max-w-2xl text-sm leading-5 text-[var(--cs-text-secondary)]">
            {description}
          </CardDescription>
        ) : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="px-4 py-4">{children}</CardContent>
    </Card>
  );
}
