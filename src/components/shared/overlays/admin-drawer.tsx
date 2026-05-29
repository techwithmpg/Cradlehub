"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AdminDrawerSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AdminDrawerSize, string> = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[640px]",
};

export type AdminDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  size?: AdminDrawerSize;
  className?: string;
  showCloseButton?: boolean;
};

export function AdminDrawer({
  open,
  onOpenChange,
  children,
  size = "md",
  className,
  showCloseButton = true,
}: AdminDrawerProps) {
  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/35 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
          )}
        />
        <SheetPrimitive.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-3/4 flex-col overflow-hidden border-l border-[var(--cs-border)] bg-popover text-popover-foreground shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:translate-x-[2.5rem] data-starting-style:translate-x-[2.5rem]",
            SIZE_CLASSES[size],
            className
          )}
        >
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  className="absolute top-3 right-3 text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Popup>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}
