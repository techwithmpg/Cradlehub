"use server";

import { updateBookingStatusAction } from "@/app/(dashboard)/manager/bookings/actions";
import { markBookingConfirmedAction } from "@/app/(dashboard)/crm/bookings/actions";
import type { BookingOperationResult } from "@/lib/bookings/crm-booking-operations";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import {
  getCrmTodayOperationalData,
  type CrmTodayOperationalData,
} from "@/lib/queries/crm-today-operational";

export async function updateWorkQueueBookingStatusAction(
  rawInput: unknown
): Promise<BookingOperationResult> {
  const input = rawInput as { bookingId?: unknown; status?: unknown; notes?: unknown } | null;

  if (input?.status === "confirmed") {
    return markBookingConfirmedAction({
      bookingId: input.bookingId,
      note: typeof input.notes === "string" ? input.notes : undefined,
    });
  }

  return updateBookingStatusAction(rawInput);
}

export async function refreshCrmTodayOperationalDataAction(): Promise<CrmTodayOperationalData> {
  const context = await getFrontDeskContext();
  const date = getBranchBusinessDate();
  return getCrmTodayOperationalData({ branchId: context.branchId, date });
}
