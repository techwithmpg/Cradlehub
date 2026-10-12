import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { StaffStatusChip } from "@/components/features/staff-pwa/native-foundation";
import { formatTime12h } from "@/lib/utils/time-format";
import { getDriverProgressLabel } from "@/lib/staff-pwa/driver-ui-model";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export function DriverTripRow({
  item,
  showDate = false,
}: {
  item: RealDispatchItem;
  showDate?: boolean;
}) {
  const destination = item.formattedAddress ?? item.area;
  return (
    <Link
      href={`/staff/driver/trips/${item.id}`}
      className="flex min-h-20 items-center gap-3 border-b border-[#eee8dc] px-4 py-3 text-[#20342c] last:border-0 focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f3e9d6] text-xs font-bold tabular-nums text-[#76501a]">
        {formatTime12h(item.startTime)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{item.customerName}</span>
          <StaffStatusChip tone={item.dispatchStatus === "completed" ? "green" : "gold"}>
            {getDriverProgressLabel(item)}
          </StaffStatusChip>
        </div>
        <p className="mt-1 truncate text-xs text-[#65746b]">
          {showDate ? `${item.bookingDate} · ` : ""}
          {item.serviceName}
        </p>
        {destination ? (
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-[#65746b]">
            <MapPin size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{destination}</span>
          </p>
        ) : null}
      </div>
      <ChevronRight size={17} className="shrink-0 text-[#65746b]" aria-hidden="true" />
    </Link>
  );
}
