"use client";

import { cn } from "@/lib/utils";

export type AdminOverlayToolbarProps = {
  children: React.ReactNode;
  className?: string;
};

export function AdminOverlayToolbar({
  children,
  className,
}: AdminOverlayToolbarProps) {
  return (
    <div
      className={cn(
        "shrink-0 border-b border-[var(--cs-border)] px-5 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}
