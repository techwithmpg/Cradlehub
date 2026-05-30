import { formatCurrency, formatDate } from "@/lib/utils";

export function safeFormatDate(date: string | null | undefined): string {
  if (!date) return "—";
  try {
    return formatDate(date);
  } catch {
    return "—";
  }
}

export function safeFormatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "₱0.00";
  return formatCurrency(amount);
}

export function formatDaysSince(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days`;
}

export function formatVisitCount(count: number | null | undefined): string {
  if (count === null || count === undefined) return "0 visits";
  return `${count} visit${count !== 1 ? "s" : ""}`;
}
