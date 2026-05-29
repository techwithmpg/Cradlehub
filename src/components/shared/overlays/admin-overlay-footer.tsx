"use client";

import { cn } from "@/lib/utils";

export type AdminOverlayFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function AdminOverlayFooter({
  children,
  className,
}: AdminOverlayFooterProps) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-[var(--cs-border)] bg-popover/95 px-5 py-4 backdrop-blur-sm supports-[backdrop-filter]:bg-popover/80",
        className
      )}
    >
      {children}
    </div>
  );
}
