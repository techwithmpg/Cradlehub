export type OrderDisplayStage = "waiting" | "in_service" | "ready_to_pay" | "completed";

export type GroupableBooking = {
  id: string;
  order_id?: string | null;
  attendee_id?: string | null;
  booking_date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  booking_progress_status?: string | null;
  session_started_at?: string | null;
  session_completed_at?: string | null;
  delivery_type?: string | null;
  type: string;
  booking_attendees?:
    | { id: string; sequence: number; display_name: string | null; customer_id: string | null }
    | { id: string; sequence: number; display_name: string | null; customer_id: string | null }[]
    | null;
  booking_orders?:
    | {
        id: string;
        order_number: string;
        organizer_customer_id: string;
        metadata: Record<string, unknown> | null;
      }
    | {
        id: string;
        order_number: string;
        organizer_customer_id: string;
        metadata: Record<string, unknown> | null;
      }[]
    | null;
};

export type OrderPaymentSummary = {
  total: number | null;
  paid: number | null;
  due: number | null;
  status: string | null;
};

export type BookingDisplayGroup<T extends GroupableBooking> = {
  displayId: string;
  orderId: string | null;
  orderNumber: string | null;
  primaryBookingId: string;
  organizerName: string;
  guestCount: number;
  serviceCount: number;
  lines: T[];
  bookingDate: string;
  startTime: string;
  endTime: string | null;
  elapsedMinutes: number | null;
  deliveryType: string;
  payment: OrderPaymentSummary;
  attentionSummary: string[];
  stage: OrderDisplayStage;
};

export type BookingGroupRead<T extends GroupableBooking> = {
  organizerName: (line: T) => string;
  payment: (line: T) => OrderPaymentSummary;
  attention: (line: T) => string[];
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function minutes(value: string | null | undefined): number | null {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isClosed(line: GroupableBooking): boolean {
  return ["cancelled", "no_show", "expired"].includes(line.status);
}

function isComplete(line: GroupableBooking): boolean {
  return (
    line.status === "completed" ||
    line.booking_progress_status === "completed" ||
    Boolean(line.session_completed_at)
  );
}

export function groupBookingsByOrder<T extends GroupableBooking>(
  rows: readonly T[],
  read: BookingGroupRead<T>,
  options: { groupOrders?: boolean } = {}
): BookingDisplayGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const key =
      options.groupOrders !== false && row.order_id ? `order:${row.order_id}` : `booking:${row.id}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  return [...buckets.values()].map((unsorted) => {
    const lines = [...unsorted].sort(
      (a, b) =>
        a.booking_date.localeCompare(b.booking_date) ||
        a.start_time.localeCompare(b.start_time) ||
        (first(a.booking_attendees)?.sequence ?? 0) - (first(b.booking_attendees)?.sequence ?? 0) ||
        a.id.localeCompare(b.id)
    );
    const primary = lines[0]!;
    const orderId = options.groupOrders === false ? null : (primary.order_id ?? null);
    const order = first(primary.booking_orders);
    const attendeeIds = new Set(
      lines
        .map((line) => line.attendee_id ?? first(line.booking_attendees)?.id)
        .filter((id): id is string => Boolean(id))
    );
    const start = lines.reduce(
      (earliest, line) => (line.start_time < earliest ? line.start_time : earliest),
      primary.start_time
    );
    const end = lines.reduce<string | null>((latest, line) => {
      if (!line.end_time) return latest;
      return !latest || line.end_time > latest ? line.end_time : latest;
    }, null);
    const startMinute = minutes(start);
    const endMinute = minutes(end);
    const payment = read.payment(primary);
    const applicable = lines.filter((line) => !isClosed(line));
    const active = applicable.some(
      (line) =>
        !isComplete(line) &&
        (line.status === "in_progress" ||
          line.booking_progress_status === "session_started" ||
          Boolean(line.session_started_at))
    );
    const allComplete = applicable.length > 0 && applicable.every(isComplete);
    const allClosedOrComplete = lines.every((line) => isClosed(line) || isComplete(line));
    const settled = payment.status === "paid" || payment.due === 0;
    const stage: OrderDisplayStage = active
      ? "in_service"
      : allComplete && !settled
        ? "ready_to_pay"
        : allClosedOrComplete && settled
          ? "completed"
          : "waiting";
    const issueCounts = new Map<string, number>();
    for (const line of lines) {
      for (const issue of new Set(read.attention(line))) {
        issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
      }
    }
    return {
      displayId: orderId ? `order:${orderId}` : `booking:${primary.id}`,
      orderId,
      orderNumber: order?.order_number ?? null,
      primaryBookingId: primary.id,
      organizerName: read.organizerName(primary),
      guestCount: orderId ? attendeeIds.size : 1,
      serviceCount: lines.length,
      lines,
      bookingDate: primary.booking_date,
      startTime: start,
      endTime: end,
      elapsedMinutes:
        startMinute === null || endMinute === null ? null : Math.max(0, endMinute - startMinute),
      deliveryType: primary.delivery_type ?? primary.type,
      payment,
      attentionSummary: [...issueCounts].map(([issue, count]) =>
        count > 1 ? `${count} ${issue}` : issue
      ),
      stage,
    };
  });
}

export function findBookingGroup<T extends GroupableBooking>(
  groups: readonly BookingDisplayGroup<T>[],
  bookingId: string | null | undefined
) {
  return groups.find(
    (group) => group.displayId === bookingId || group.lines.some((line) => line.id === bookingId)
  );
}

export function matchesBookingGroupSearch<T extends GroupableBooking>(
  group: BookingDisplayGroup<T>,
  search: string,
  fields: (line: T) => Array<string | null | undefined>
): boolean {
  const term = search.trim().toLocaleLowerCase("en-PH");
  if (!term) return true;
  return [
    group.organizerName,
    group.orderNumber,
    group.orderId,
    ...group.lines.flatMap((line) => [
      line.id,
      first(line.booking_attendees)?.display_name,
      ...fields(line),
    ]),
  ].some((value) => value?.toLocaleLowerCase("en-PH").includes(term));
}
