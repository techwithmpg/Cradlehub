"use client";

import { cn } from "@/lib/utils";

export type AdminOverlayBodyProps = {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
};

export function AdminOverlayBody({
  children,
  className,
  padded = true,
}: AdminOverlayBodyProps) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        padded && "px-5 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}
