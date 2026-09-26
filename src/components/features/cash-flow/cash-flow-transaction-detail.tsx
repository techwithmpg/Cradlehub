import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { formatTime12h } from "@/lib/utils/time-format";
import type { CashFlowEntry } from "@/lib/cash-flow/read-model";
import { CashFlowStatus, peso } from "./cash-flow-ui";

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
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg rounded-2xl border-[var(--cs-border-soft)] p-6">
        <DialogTitle className="text-lg font-bold text-[var(--cs-text)]">
          Booking payment details
        </DialogTitle>
        <DialogDescription className="text-xs text-[var(--cs-text-secondary)]">
          Current canonical booking payment record.
        </DialogDescription>

        {entry && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--cs-text-muted)]">Recorded amount</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-800">
                    {peso(entry.amount)}
                  </p>
                </div>
                <CashFlowStatus tone={entry.paymentStatus}>
                  {entry.paymentStatus}
                </CashFlowStatus>
              </div>

              {entry.outstanding > 0 ? (
                <p className="mt-2 text-xs font-semibold text-amber-800">
                  Outstanding balance: {peso(entry.outstanding)}
                </p>
              ) : null}
            </div>

            <dl className="divide-y divide-[var(--cs-border-soft)] text-xs">
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
                ["Booking payable", peso(entry.payable)],
                [
                  "Service line price",
                  entry.servicePrice === null ? "Not recorded" : peso(entry.servicePrice),
                ],
                [
                  "Assigned travel fee",
                  entry.travelFee === null ? "Not recorded" : peso(entry.travelFee),
                ],
                ["Reference", entry.reference || `#BK-${entry.id.slice(0, 8)}`],
                ["Booking ID", entry.id],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[140px_1fr] py-2.5">
                  <dt className="text-[var(--cs-text-muted)] font-medium">{label}</dt>
                  <dd className="break-words font-semibold text-[var(--cs-text)]">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="pt-2">
              <Link
                prefetch={false}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--cs-border)] bg-white font-semibold text-xs text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface-warm)]"
                href={`/crm/bookings?date=${encodeURIComponent(entry.date)}&bookingId=${encodeURIComponent(entry.id)}`}
              >
                Open Booking in CRM
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
