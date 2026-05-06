"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { updateBookingStatusSchema } from "@/lib/validations/booking";
import {
  getAllBookingsOwner,
  getBookingById,
} from "@/lib/queries/bookings";
import {
  getOwnerDashboardStats,
  getRevenueByBranch,
  getBookingsPerTherapist,
  getBookingTrend,
} from "@/lib/queries/analytics";
import { revalidatePath } from "next/cache";
import { updateBookingPaymentSchema } from "@/lib/validations/booking";
import { getCrossbranchCashSummary } from "@/lib/queries/analytics";

// ── Auth: owner only ──────────────────────────────────────────────────────
async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return { supabase, me: { id: "dev", system_role: "owner" } };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (me?.system_role !== "owner") return null;
  return { supabase, me };
}

// ── Owner dashboard: cross-branch today overview ───────────────────────────
export async function getOwnerDashboardAction(date: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getOwnerDashboardStats(date);
}

// ── All bookings across all branches with filters ─────────────────────────
export async function getOwnerBookingsAction(filters?: {
  branchId?: string;
  staffId?:  string;
  fromDate?: string;
  toDate?:   string;
  status?:   string;
  type?:     string;
}) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getAllBookingsOwner(filters);
}

// ── Single booking detail ─────────────────────────────────────────────────
export async function getOwnerBookingDetailAction(bookingId: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getBookingById(bookingId);
}

// ── Cancel / no-show any booking — NO branch filter (Rule 11) ────────────
// Owner operates cross-branch. The update has no branch_id constraint.
export async function ownerUpdateBookingStatusAction(rawInput: unknown) {
  const parsed = updateBookingStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const ctx = await requireOwner();
  if (!ctx) return { success: false, error: "Unauthorized" };

  // Set attribution for trigger
  await (
    ctx.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    }
  )
    .rpc("set_config", {
      setting:  "app.current_staff_id",
      value:    ctx.me.id,
      is_local: true,
    })
    .catch(() => {});

  // NO branch_id filter — owner can update any booking in any branch
  const { error } = await ctx.supabase
    .from("bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookingId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner");
  revalidatePath("/owner/bookings");
  return { success: true };
}

// ── Analytics: revenue by branch ──────────────────────────────────────────
export async function getRevenueByBranchAction(fromDate: string, toDate: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getRevenueByBranch(fromDate, toDate);
}

// ── Analytics: staff productivity ────────────────────────────────────────
export async function getStaffProductivityAction(
  fromDate: string,
  toDate:   string,
  branchId?: string
) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getBookingsPerTherapist(fromDate, toDate, branchId);
}

// ── Analytics: booking trend chart data ──────────────────────────────────
export async function getBookingTrendAction(days = 30) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getBookingTrend(days);
}

// ── Analytics: cross-branch cash summary ─────────────────────────────────
export async function getCashSummaryAction(fromDate: string, toDate: string, branchId?: string) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" };
  return getCrossbranchCashSummary(fromDate, toDate, branchId);
}

// ── Update payment on any booking (cross-branch, owner only) ─────────────
// No branch filter — owner can record payment for any branch.
export async function ownerUpdateBookingPaymentAction(rawInput: unknown) {
  const parsed = updateBookingPaymentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireOwner();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { bookingId, paymentMethod, paymentStatus, amountPaid, paymentReference } = parsed.data;

  const { error } = await ctx.supabase
    .from("bookings")
    .update({
      payment_method:    paymentMethod,
      payment_status:    paymentStatus,
      amount_paid:       amountPaid,
      payment_reference: paymentReference ?? null,
    })
    .eq("id", bookingId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/owner");
  revalidatePath("/owner/bookings");
  revalidatePath("/owner/reports");
  return { success: true };
}
