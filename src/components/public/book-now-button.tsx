"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { useBookingWizard } from "@/components/public/booking-wizard-provider";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type BookNowButtonProps = VariantProps<typeof buttonVariants> & {
  serviceId?: string;
  className?: string;
  children?: React.ReactNode;
};

export function BookNowButton({
  serviceId,
  className,
  variant = "default",
  size = "default",
  children = "Book Now",
}: BookNowButtonProps) {
  const { openWizard } = useBookingWizard();

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => openWizard({ serviceId })}
    >
      {children}
    </Button>
  );
}

