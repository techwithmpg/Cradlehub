export type Segment = "new" | "repeat" | "lapsed" | "vip" | null;

export interface CustomerListItem {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  total_bookings: number;
  last_booking_date: string | null;
  first_booking_date?: string | null;
  notes?: string | null;
  preferred_staff_id?: string | null;
  staff?: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
}

export function computeSegment(customer: Pick<CustomerListItem, "total_bookings" | "last_booking_date">): Segment {
  if (customer.total_bookings === 1) return "new";
  if (customer.total_bookings >= 2) {
    if (customer.last_booking_date) {
      const daysSince = daysSinceDate(customer.last_booking_date);
      if (daysSince >= 30) return "lapsed";
    }
    return "repeat";
  }
  return null;
}

export function daysSinceDate(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function isThisMonth(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function isThisWeek(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}
