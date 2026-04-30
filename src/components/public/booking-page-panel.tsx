"use client";

import { BookingWizard } from "@/components/public/booking-wizard";

export function BookingPagePanel() {
  return (
    <div className="rounded-3xl border border-[#f6e3a1]/18 bg-[linear-gradient(170deg,rgba(44,30,21,0.8),rgba(25,18,13,0.76))] p-4 shadow-[0_14px_34px_rgba(10,7,5,0.28)] md:p-6">
      <BookingWizard mode="page" />
    </div>
  );
}
