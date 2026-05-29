"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AdminDialogSize = "sm" | "md" | "lg" | "xl" | "wide" | "full";

const SIZE_CLASSES: Record<AdminDialogSize, string> = {
  sm: "sm:max-w-[480px]",
  md: "sm:max-w-[640px]",
  lg: "sm:max-w-[760px]",
  xl: "sm:max-w-[920px]",
  wide: "sm:max-w-[1080px]",
  full: "sm:max-w-[calc(100vw-2rem)]",
};

export type AdminDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  size?: AdminDialogSize;
  className?: string;
  showCloseButton?: boolean;
};

export function AdminDialog({
  open,
  onOpenChange,
  children,
  size = "lg",
  className,
  showCloseButton = true,
}: AdminDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 isolate z-50 bg-black/35 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-6 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-popover text-popover-foreground shadow-lg duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            SIZE_CLASSES[size],
            "h-auto max-h-[calc(100dvh-3rem)]",
            className
          )}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
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
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
