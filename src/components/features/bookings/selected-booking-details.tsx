import type { WorkspaceBookingRow } from "./booking-workspace-types";
import {
  firstBookingRelation,
  getBookingDeliveryLabel,
  getBookingSourceLabel,
  readBookingAddOns,
} from "@/lib/bookings/booking-display";

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function readHomeAddress(metadata?: Record<string, unknown> | null): string | null {
  const raw = metadata?.home_service_address;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const address = (raw as Record<string, unknown>).full_address;
  return typeof address === "string" && address.trim() ? address : null;
}

export function SelectedBookingDetails({ booking }: { booking: WorkspaceBookingRow }) {
  const branch = firstBookingRelation(booking.branches);
  const addOns = readBookingAddOns(booking.metadata);
  const rows = [
    ["Branch", branch?.name],
    ["Booking type", getBookingDeliveryLabel(booking)],
    ["Source", getBookingSourceLabel(booking)],
    ["Payment reference", booking.payment_reference],
    ["Created", formatDateTime(booking.created_at)],
    ["Updated", formatDateTime(booking.updated_at)],
    ["Add-ons", addOns],
    ["Travel buffer", booking.travel_buffer_mins ? `${booking.travel_buffer_mins} min` : null],
    ["Destination", readHomeAddress(booking.metadata)],
    ["Internal reference", booking.id],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
      {rows.map(([label, value]) => (
        <div key={label} className={label === "Destination" || label === "Internal reference" ? "col-span-2" : undefined}>
          <dt className="text-xs font-medium text-[var(--cs-text-muted)]">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-[var(--cs-text)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
