import { CalendarDays } from "lucide-react";
import { StaffStatusChip } from "@/components/features/staff-pwa/native-foundation";
import { crmBookingStatusLabel, type CrmMobileBooking } from "@/lib/staff-pwa/crm-model";

export function CrmBookingRow({
  booking,
  showDate = false,
}: {
  booking: CrmMobileBooking;
  showDate?: boolean;
}) {
  const status = crmBookingStatusLabel(booking);
  return (
    <div className="flex min-h-20 min-w-0 items-center gap-3 border-b border-[#eee8dd] px-4 py-3 last:border-0">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f3e9d6] text-[#76501a]">
        <CalendarDays size={19} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#20342c]">
          {booking.customerName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[#65746b]">{booking.serviceName}</span>
        <span className="mt-1 block text-[11px] text-[#65746b]">
          {showDate ? `${booking.date} · ` : ""}
          {booking.time.slice(0, 5)} ·{" "}
          {booking.deliveryType === "home_service"
            ? "Home Service"
            : booking.deliveryType === "in_spa"
              ? "In spa"
              : "Service"}
        </span>
      </span>
      <StaffStatusChip tone={status === "Needs review" ? "gold" : "green"}>
        {status}
      </StaffStatusChip>
    </div>
  );
}
