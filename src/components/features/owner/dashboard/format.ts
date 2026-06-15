export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `₱${Math.round(amount / 100_000) / 10}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `₱${Math.round(amount / 100) / 10}K`;
  }
  return formatCurrency(amount);
}

export function formatTime(time: string): string {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw ?? 0);
  const minutes = Number(minutesRaw ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatDelta(current: number, previous: number): string {
  const delta = current - previous;
  if (delta === 0) return "- vs yesterday";
  const label = Math.abs(delta).toLocaleString("en-PH");
  return `${delta > 0 ? "+" : "-"}${label} vs yesterday`;
}

export function formatCurrencyDelta(current: number, previous: number): string {
  const delta = current - previous;
  if (delta === 0) return "- vs yesterday";
  return `${delta > 0 ? "+" : "-"}${formatCurrency(Math.abs(delta))} vs yesterday`;
}
