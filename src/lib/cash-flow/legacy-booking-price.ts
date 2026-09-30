export function validatedLegacyBookingPrice(metadata: Record<string, unknown> | null): number | null {
  const raw = metadata?.price_paid;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || Number(amount.toFixed(2)) !== amount) {
    return null;
  }
  return amount;
}
