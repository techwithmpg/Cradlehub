export function formatTimeLabel(time: string): string {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return time;
  }

  const hour12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
}

export function formatCurrency(value: number): string {
  return `₱${value.toLocaleString()}`;
}

export function formatVisibility(value: string): string {
  if (value === "csr_only") return "CSR only";
  if (value === "vip") return "VIP only";
  return "Public";
}
