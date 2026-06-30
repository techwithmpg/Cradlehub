"use server";

import { z } from "zod";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getQuickBookingCustomerPrefill } from "@/lib/queries/quick-booking-options";
import type { QuickBookingCustomerOption } from "@/components/features/bookings/quick-booking-form";

const customerPrefillSchema = z.object({
  customerId: z.guid("Invalid customer ID."),
});

export type AdministrativeBookingCustomerPrefillResult =
  | { ok: true; customer: QuickBookingCustomerOption | null }
  | { ok: false; message: string };

export async function getAdministrativeBookingCustomerPrefillAction(
  rawInput: unknown
): Promise<AdministrativeBookingCustomerPrefillResult> {
  const parsed = customerPrefillSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Customer could not be loaded." };
  }

  try {
    await getFrontDeskContext();
    const customer = await getQuickBookingCustomerPrefill(parsed.data.customerId);
    return { ok: true, customer };
  } catch (error) {
    console.error("[administrative-booking] customer prefill failed", {
      customerId: parsed.data.customerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Customer could not be loaded." };
  }
}
