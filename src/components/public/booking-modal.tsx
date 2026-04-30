"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BookingWizard } from "@/components/public/booking-wizard";

type BookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialServiceId?: string;
};

export function BookingModal({ open, onOpenChange, initialServiceId }: BookingModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] max-w-3xl overflow-hidden border-[#f6e3a1]/30 bg-[radial-gradient(circle_at_18%_0%,rgba(246,227,161,0.22),transparent_34%),linear-gradient(180deg,#2f1f14,#1f1510)] text-[#f9f2df]"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-[#fff6df]">Book your appointment</DialogTitle>
            <DialogDescription className="text-[#f8ecd1]/75">
              Premium booking in under 60 seconds.
            </DialogDescription>
          </DialogHeader>
          <BookingWizard
            initialServiceId={initialServiceId}
            onClose={() => onOpenChange(false)}
            mode="modal"
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] rounded-t-3xl border-[#f6e3a1]/30 bg-[radial-gradient(circle_at_20%_0%,rgba(246,227,161,0.2),transparent_34%),linear-gradient(180deg,#301f14,#1f1510)] text-[#f9f2df]"
        showCloseButton
      >
        <SheetHeader className="px-0 pb-1">
          <SheetTitle className="font-heading text-xl text-[#fff6df]">Book your appointment</SheetTitle>
          <SheetDescription className="text-[#f8ecd1]/75">
            Quick booking with instant confirmation.
          </SheetDescription>
        </SheetHeader>
        <BookingWizard
          initialServiceId={initialServiceId}
          onClose={() => onOpenChange(false)}
          mode="modal"
        />
      </SheetContent>
    </Sheet>
  );
}
