"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateCustomerSchema } from "@/lib/validations/customer";
import {
  getAllCustomers,
  getCustomerById,
  getLapsedCustomers,
  getRepeatCustomers,
  searchCustomers,
} from "@/lib/queries/customers";
import { getBookingsByCustomer } from "@/lib/queries/bookings";

// -- Auth helper: CRM + owner only ------------------------------------------
async function requireCrmAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .single();
  if (!me || !["crm", "owner"].includes(me.system_role)) return null;
  return supabase;
}

// -- Customer list (paginated) ----------------------------------------------
export async function getCustomerListAction(page = 1) {
  const supabase = await requireCrmAccess();
  if (!supabase) return { error: "Unauthorized" };
  return getAllCustomers(page, 20);
}

// -- Search customers --------------------------------------------------------
export async function searchCustomersAction(query: string) {
  const supabase = await requireCrmAccess();
  if (!supabase) return { error: "Unauthorized" };
  return searchCustomers(query);
}

// -- Full customer profile with booking history ------------------------------
export async function getCustomerProfileAction(customerId: string) {
  const supabase = await requireCrmAccess();
  if (!supabase) return { error: "Unauthorized" };
  const [customer, bookings] = await Promise.all([
    getCustomerById(customerId),
    getBookingsByCustomer(customerId),
  ]);
  return { customer, bookings };
}

// -- Update customer notes / preferred therapist (Rule 12) -------------------
export async function updateCustomerAction(rawInput: unknown) {
  const parsed = updateCustomerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await requireCrmAccess();
  if (!supabase) return { success: false, error: "Unauthorized" };

  const { customerId, ...updates } = parsed.data;
  const { error } = await supabase
    .from("customers")
    .update({
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.preferredStaffId !== undefined && {
        preferred_staff_id: updates.preferredStaffId,
      }),
    })
    .eq("id", customerId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/crm/${customerId}`);
  return { success: true };
}

// -- Repeat customers list ---------------------------------------------------
export async function getRepeatCustomersAction(page = 1) {
  const supabase = await requireCrmAccess();
  if (!supabase) return { error: "Unauthorized" };
  return getRepeatCustomers(3, page, 20);
}

// -- Lapsed customers (re-engagement) ---------------------------------------
export async function getLapsedCustomersAction() {
  const supabase = await requireCrmAccess();
  if (!supabase) return { error: "Unauthorized" };
  return getLapsedCustomers(30, 50);
}
