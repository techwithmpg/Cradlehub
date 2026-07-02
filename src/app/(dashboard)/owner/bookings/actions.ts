"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { updateBookingStatusSchema } from "@/lib/validations/booking";
import {
  getAllBookings,
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
import { cacheTags, invalidateTag } from "@/lib/cache/cache-tags";
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
    return { supabase, me: { id: null as string | null, system_role: "owner" } };
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

  // Set attribution for trigger (fire-and-forget — non-critical).
  // set_config is a Postgres built-in, not in generated Supabase types — cast required.
  if (ctx.me.id) {
    try {
      await (ctx.supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> })
        .rpc("set_config", { setting: "app.current_staff_id", value: ctx.me.id, is_local: true });
    } catch {
      // Non-critical: trigger attribution may not run, booking update proceeds
    }
  }

  // Fetch branch_id for cache invalidation (owner is cross-branch).
  const { data: booking } = await ctx.supabase
    .from("bookings")
    .select("branch_id")
    .eq("id", parsed.data.bookingId)
    .single();

  // NO branch_id filter — owner can update any booking in any branch
  const { error } = await ctx.supabase
    .from("bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.bookingId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/owner");
  revalidatePath("/owner/bookings");
  if (booking?.branch_id) {
    invalidateTag(cacheTags.ownerWorkspace(booking.branch_id));
    invalidateTag(cacheTags.crmWorkspace(booking.branch_id));
  }
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

// ── Payment-aware booking list for the new shared workspace ──────────────
// Uses the full-featured query that returns payment fields + branch resources.
export async function getOwnerWorkspaceBookingsAction(filters?: {
  date?:     string;
  branchId?: string;
  status?:   string;
  type?:     string;
}) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" as const };
  const bookings = await getAllBookings({
    date:     filters?.date,
    branchId: filters?.branchId,
    status:   filters?.status,
    type:     filters?.type,
  });
  return { bookings };
}

// ── Update payment on any booking (cross-branch, owner only) ─────────────
// No branch filter — owner can record payment for any branch.
// Appends an audit row to booking_payment_logs before updating.
export async function ownerUpdateBookingPaymentAction(rawInput: unknown) {
  const parsed = updateBookingPaymentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireOwner();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { bookingId, paymentMethod, paymentStatus, amountPaid, paymentReference, reason } = parsed.data;

  // Fetch current payment state for audit log
  const { data: before } = await ctx.supabase
    .from("bookings")
    .select("branch_id, payment_method, payment_status, amount_paid, payment_reference")
    .eq("id", bookingId)
    .single();

  const isSignificantChange =
    (before?.payment_status === "paid" && paymentStatus !== "paid") ||
    ((before?.amount_paid ?? 0) > amountPaid);

  if (isSignificantChange && !reason?.trim()) {
    return { success: false, error: "Reason is required for voids, refunds, or corrections" };
  }

  // Insert audit log
  await ctx.supabase.from("booking_payment_logs").insert({
    booking_id:            bookingId,
    changed_by:            ctx.me.id ?? null,
    old_payment_method:    before?.payment_method ?? null,
    old_payment_status:    before?.payment_status ?? null,
    old_amount_paid:       before?.amount_paid ?? null,
    old_payment_reference: before?.payment_reference ?? null,
    new_payment_method:    paymentMethod,
    new_payment_status:    paymentStatus,
    new_amount_paid:       amountPaid,
    new_payment_reference: paymentReference ?? null,
    reason:                reason?.trim() ?? null,
  });

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
  if (before?.branch_id) {
    invalidateTag(cacheTags.ownerWorkspace(before.branch_id));
    invalidateTag(cacheTags.crmWorkspace(before.branch_id));
  }
  return { success: true };
}
