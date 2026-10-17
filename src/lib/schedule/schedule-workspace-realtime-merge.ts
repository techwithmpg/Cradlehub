import type {
  DailyScheduleApiResponse,
} from "@/components/features/schedule/hooks/use-live-daily-schedule";
import type { DailyScheduleBooking } from "@/lib/queries/schedule";

export type ScheduleRealtimeChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE" | string;
  newRow: unknown;
  oldRow: unknown;
};

type BookingRealtimeRow = {
  id: string;
  branch_id?: string | null;
  booking_date?: string | null;
  staff_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  type?: string | null;
  delivery_type?: string | null;
  resource_id?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  amount_paid?: number | string | null;
  service_id?: string | null;
};

type CheckinRealtimeRow = {
  id: string;
  branch_id?: string | null;
  staff_id?: string | null;
  attendance_business_date?: string | null;
  shift_date?: string | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  status?: string | null;
};

export type ScheduleRealtimeMergeResult = {
  data: DailyScheduleApiResponse;
  relevant: boolean;
  patched: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown): string | null | undefined {
  return value === undefined ? undefined : typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bookingRow(value: unknown): BookingRealtimeRow | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    branch_id: stringOrNull(row.branch_id),
    booking_date: stringOrNull(row.booking_date),
    staff_id: stringOrNull(row.staff_id),
    start_time: stringOrNull(row.start_time),
    end_time: stringOrNull(row.end_time),
    status: stringOrNull(row.status),
    type: stringOrNull(row.type),
    delivery_type: stringOrNull(row.delivery_type),
    resource_id: stringOrNull(row.resource_id),
    payment_method: stringOrNull(row.payment_method),
    payment_status: stringOrNull(row.payment_status),
    amount_paid: numberOrNull(row.amount_paid),
    service_id: stringOrNull(row.service_id),
  };
}

function checkinRow(value: unknown): CheckinRealtimeRow | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    branch_id: stringOrNull(row.branch_id),
    staff_id: stringOrNull(row.staff_id),
    attendance_business_date: stringOrNull(row.attendance_business_date),
    shift_date: stringOrNull(row.shift_date),
    checked_in_at: stringOrNull(row.checked_in_at),
    checked_out_at: stringOrNull(row.checked_out_at),
    status: stringOrNull(row.status),
  };
}

function bookingId(change: ScheduleRealtimeChange): string | null {
  return bookingRow(change.newRow)?.id ?? bookingRow(change.oldRow)?.id ?? null;
}

function checkinId(change: ScheduleRealtimeChange): string | null {
  return checkinRow(change.newRow)?.id ?? checkinRow(change.oldRow)?.id ?? null;
}

function findBooking(
  data: DailyScheduleApiResponse,
  id: string
): { booking: DailyScheduleBooking; staffId: string } | null {
  for (const staff of data.staffRows) {
    const booking = staff.bookings.find((candidate) => candidate.id === id);
    if (booking) return { booking, staffId: staff.staff_id };
  }
  return null;
}

function bookingDateMatches(row: BookingRealtimeRow | null, date: string): boolean {
  return row?.booking_date === date;
}

function checkinDateMatches(row: CheckinRealtimeRow | null, date: string): boolean {
  return row?.attendance_business_date === date || row?.shift_date === date;
}

function sortBookings(bookings: DailyScheduleBooking[]): DailyScheduleBooking[] {
  return [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function mergeScheduleBookingRealtimeChange(
  data: DailyScheduleApiResponse,
  date: string,
  change: ScheduleRealtimeChange
): ScheduleRealtimeMergeResult {
  const nextRow = bookingRow(change.newRow);
  const oldRow = bookingRow(change.oldRow);
  const id = bookingId(change);
  if (!id) return { data, relevant: false, patched: false };

  const existing = findBooking(data, id);
  const relevant =
    Boolean(existing) || bookingDateMatches(nextRow, date) || bookingDateMatches(oldRow, date);
  if (!relevant) return { data, relevant: false, patched: false };

  if (
    (nextRow?.branch_id && nextRow.branch_id !== data.branchId) ||
    (oldRow?.branch_id && oldRow.branch_id !== data.branchId && !existing)
  ) {
    return { data, relevant: false, patched: false };
  }

  if (change.eventType === "DELETE") {
    if (!existing) return { data, relevant: true, patched: false };
    return {
      data: {
        ...data,
        staffRows: data.staffRows.map((staff) =>
          staff.staff_id === existing.staffId
            ? { ...staff, bookings: staff.bookings.filter((booking) => booking.id !== id) }
            : staff
        ),
      },
      relevant: true,
      patched: true,
    };
  }

  if (!nextRow || nextRow.booking_date !== date) {
    if (!existing) return { data, relevant: true, patched: false };
    return {
      data: {
        ...data,
        staffRows: data.staffRows.map((staff) =>
          staff.staff_id === existing.staffId
            ? { ...staff, bookings: staff.bookings.filter((booking) => booking.id !== id) }
            : staff
        ),
      },
      relevant: true,
      patched: true,
    };
  }

  if (!existing) {
    // Inserts require joined customer/service/resource data. Keep canonical server authority.
    return { data, relevant: true, patched: false };
  }

  if (nextRow.staff_id === null) {
    return {
      data: {
        ...data,
        staffRows: data.staffRows.map((staff) =>
          staff.staff_id === existing.staffId
            ? { ...staff, bookings: staff.bookings.filter((booking) => booking.id !== id) }
            : staff
        ),
      },
      relevant: true,
      patched: true,
    };
  }

  const targetStaffId =
    nextRow.staff_id === undefined ? existing.staffId : nextRow.staff_id;
  const targetStaff = data.staffRows.find((staff) => staff.staff_id === targetStaffId);
  if (!targetStaff || !nextRow.start_time || !nextRow.end_time) {
    return { data, relevant: true, patched: false };
  }

  if (
    nextRow.service_id !== undefined &&
    nextRow.service_id !== (existing.booking.service_id ?? null)
  ) {
    // Service labels/metadata are joined server data; do not show the old service under a new ID.
    return { data, relevant: true, patched: false };
  }

  const resource =
    nextRow.resource_id === undefined
      ? undefined
      : nextRow.resource_id
        ? data.branchResources.find((candidate) => candidate.id === nextRow.resource_id) ?? null
        : null;

  if (nextRow.resource_id && !resource) {
    // Resource labels/type/capacity must come from authoritative branch resource data.
    return { data, relevant: true, patched: false };
  }

  const updatedBooking: DailyScheduleBooking = {
    ...existing.booking,
    start_time: nextRow.start_time,
    end_time: nextRow.end_time,
    ...(nextRow.service_id !== undefined && { service_id: nextRow.service_id }),
    ...(nextRow.status !== undefined && nextRow.status !== null && { status: nextRow.status }),
    ...(nextRow.type !== undefined && { type: nextRow.type }),
    ...(nextRow.delivery_type !== undefined && { delivery_type: nextRow.delivery_type }),
    ...(nextRow.payment_method !== undefined && { payment_method: nextRow.payment_method }),
    ...(nextRow.payment_status !== undefined && { payment_status: nextRow.payment_status }),
    ...(nextRow.amount_paid !== undefined && { amount_paid: nextRow.amount_paid }),
    ...(nextRow.resource_id !== undefined && {
      resource_id: nextRow.resource_id,
      resource_name: resource?.name ?? null,
      resource_type: resource?.type ?? null,
      resource_capacity:
        resource?.capacity === null || resource?.capacity === undefined
          ? null
          : Number(resource.capacity),
    }),
  };

  return {
    data: {
      ...data,
      staffRows: data.staffRows.map((staff) => {
        const withoutBooking = staff.bookings.filter((booking) => booking.id !== id);
        if (staff.staff_id !== targetStaffId) {
          return withoutBooking.length === staff.bookings.length
            ? staff
            : { ...staff, bookings: withoutBooking };
        }
        return { ...staff, bookings: sortBookings([...withoutBooking, updatedBooking]) };
      }),
    },
    relevant: true,
    patched: true,
  };
}

export function mergeScheduleAttendanceRealtimeChange(
  data: DailyScheduleApiResponse,
  date: string,
  change: ScheduleRealtimeChange
): ScheduleRealtimeMergeResult {
  const nextRow = checkinRow(change.newRow);
  const oldRow = checkinRow(change.oldRow);
  const id = checkinId(change);
  if (!id) return { data, relevant: false, patched: false };

  const existingPresence = data.staffRows.find(
    (staff) => staff.attendance_presence?.checkin_id === id
  );
  const relevant =
    Boolean(existingPresence) ||
    checkinDateMatches(nextRow, date) ||
    checkinDateMatches(oldRow, date);
  if (!relevant) return { data, relevant: false, patched: false };

  if (
    (nextRow?.branch_id && nextRow.branch_id !== data.branchId) ||
    (oldRow?.branch_id && oldRow.branch_id !== data.branchId && !existingPresence)
  ) {
    return { data, relevant: false, patched: false };
  }

  if (
    !nextRow ||
    !nextRow.staff_id ||
    !checkinDateMatches(nextRow, date) ||
    change.eventType === "DELETE" ||
    nextRow.status === "voided"
  ) {
    // Removing/voiding one row may reveal another historical row. Reconcile authoritatively.
    return { data, relevant: true, patched: false };
  }

  const target = data.staffRows.find((staff) => staff.staff_id === nextRow.staff_id);
  if (!target || !nextRow.checked_in_at) {
    return { data, relevant: true, patched: false };
  }

  const state = nextRow.checked_out_at ? "checked_out" : "checked_in";

  return {
    data: {
      ...data,
      staffRows: data.staffRows.map((staff) =>
        staff.staff_id === nextRow.staff_id
          ? {
              ...staff,
              attendance_presence: {
                state,
                checkin_id: nextRow.id,
                checked_in_at: nextRow.checked_in_at ?? null,
                checked_out_at: nextRow.checked_out_at ?? null,
                status: nextRow.status ?? null,
              },
            }
          : staff
      ),
    },
    relevant: true,
    patched: true,
  };
}
