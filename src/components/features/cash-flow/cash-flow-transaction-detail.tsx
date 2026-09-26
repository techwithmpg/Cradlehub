import Link from "next/link";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { formatTime12h } from "@/lib/utils/time-format";
import type { CashFlowEntry } from "@/lib/cash-flow/read-model";
import { peso } from "./cash-flow-ui";

export function CashFlowTransactionDetail({
  entry,
  onClose,
}: {
  entry: CashFlowEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!entry}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>Booking payment details</DialogTitle>
        <DialogDescription>Current canonical booking payment record.</DialogDescription>
        {entry && (
          <>
            <dl className="grid gap-3">
              {[
                ["Customer", entry.customer],
                ["Service", entry.service],
                ["Source", entry.source === "home_service" ? "Home Service" : "Booking"],
                ["Booking date / time", `${entry.date} · ${formatTime12h(entry.time)}`],
                ["Booking status", entry.bookingStatus],
                [
                  "Payment method",
                  PAYMENT_METHOD_LABELS[entry.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                    entry.method,
                ],
                ["Payment status", entry.paymentStatus],
                ["Recorded amount", peso(entry.amount)],
                ["Booking payable", peso(entry.payable)],
                ["Outstanding", peso(entry.outstanding)],
                [
                  "Service line price",
                  entry.servicePrice === null ? "Not recorded" : peso(entry.servicePrice),
                ],
                [
                  "Assigned travel fee",
                  entry.travelFee === null ? "Not recorded" : peso(entry.travelFee),
                ],
                ["Reference", entry.reference || "Not recorded"],
                ["Booking ID", entry.id],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-2 gap-3">
                  <dt className="text-[var(--cs-text-muted)]">{label}</dt>
                  <dd className="break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <Link
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--cs-border)] px-4 font-semibold"
              href={`/crm/bookings?date=${encodeURIComponent(entry.date)}&bookingId=${encodeURIComponent(entry.id)}`}
            >
              Open Booking
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
