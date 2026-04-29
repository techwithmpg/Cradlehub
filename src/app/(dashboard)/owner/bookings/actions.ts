"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateBookingStatusSchema } from "@/lib/validations/booking";
import { getAllBookingsOwner, getBookingById } from "@/lib/queries/bookings";
import {
  getBookingTrend,
  getBookingsPerTherapist,
  getOwnerDashboardStats,
  getRevenueByBranch,
} from "@/lib/queries/analytics";

// -- Auth: owner only --------------------------------------------------------
async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role")
    .eq("auth_user_id", user.id)
    .single();
  if (me?.system_role !== "owner") return null;
  return { supabase, me };
}

// -- Dashboard overview ------------------------------------------------------
export async function getOwnerDashboardAction(date: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getOwnerDashboardStats(date);
}

// -- All bookings with filters ----------------------------------------------
export async function getOwnerBookingsAction(filters?: {
  branchId?: string;
  staffId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  type?: string;
}) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getAllBookingsOwner(filters);
}

// -- Single booking detail ---------------------------------------------------
export async function getOwnerBookingDetailAction(bookingId: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getBookingById(bookingId);
}

// -- Cancel / no-show any booking (cross-branch) ----------------------------
export async function ownerUpdateBookingStatusAction(rawInput: unknown) {
  const parsed = updateBookingStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireOwner();
  if (!ctx) return { success: false, error: "Unauthorized" };

  // Owner updates any booking -- NO branch_id filter (Rule 11)
  const { error } = await ctx.supabase
    .from("bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookingId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner");
  revalidatePath("/owner/bookings");
  return { success: true };
}

// -- Analytics: revenue by branch -------------------------------------------
export async function getRevenueByBranchAction(fromDate: string, toDate: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getRevenueByBranch(fromDate, toDate);
}

// -- Analytics: staff productivity ------------------------------------------
export async function getStaffProductivityAction(
  fromDate: string,
  toDate: string,
  branchId?: string
) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getBookingsPerTherapist(fromDate, toDate, branchId);
}

// -- Analytics: booking trend (chart data) ----------------------------------
export async function getBookingTrendAction(days = 30) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getBookingTrend(days);
}
