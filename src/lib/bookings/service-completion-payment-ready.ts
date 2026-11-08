export type PaymentReadyLine = {
  status: string;
  booking_progress_status: string | null;
  payment_status: string | null;
  session_completed_at: string | null;
};

/** Only offer final settlement when every non-cancelled service in the order is finished. */
export function isOrderReadyForPayment(lines: readonly PaymentReadyLine[]): boolean {
  if (lines.length === 0) return false;
  const complete = (line: PaymentReadyLine) =>
    line.status === "completed" ||
    line.booking_progress_status === "completed" ||
    Boolean(line.session_completed_at);
  return lines.every((line) =>
    complete(line) || line.status === "cancelled" || line.status === "no_show"
  ) && lines.some((line) => complete(line) && line.payment_status !== "paid");
}
