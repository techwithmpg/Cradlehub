"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { updateBookingStatusSchema } from "@/lib/validations/booking";
import { getAllBookings, getAllBookingsOwner, getBookingById } from "@/lib/queries/bookings";
import {
  getOwnerDashboardStats,
  getRevenueByBranch,
  getBookingsPerTherapist,
  getBookingTrend,
} from "@/lib/queries/analytics";
import { revalidatePath } from "next/cache";
import { cacheTags, invalidateTag } from "@/lib/cache/cache-tags";
import { updateBookingPaymentSchema } from "@/lib/validations/booking";
import { getBookingPaymentGate } from "@/lib/bookings/payment-gate";
import { getCrossbranchCashSummary } from "@/lib/queries/analytics";

export type OwnerReportsRequest = {
  preset?: string;
  from?: string;
  to?: string;
};

export type OwnerReportsData = {
  preset: string;
  from: string;
  to: string;
  dateRangeLabel: string;
  generatedAt: string;
  revenueData: Awaited<ReturnType<typeof getRevenueByBranch>>;
  staffData: Awaited<ReturnType<typeof getBookingsPerTherapist>>;
  trendData: Awaited<ReturnType<typeof getBookingTrend>>;
  cashSummary: Awaited<ReturnType<typeof getCrossbranchCashSummary>>;
};

export type OwnerReportsResult =
  | { success: true; data: OwnerReportsData }
  | { success: false; error: string };

const REPORT_PRESETS = new Set(["today", "last7", "last30", "thisMonth"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function reportRange(request: OwnerReportsRequest) {
  const preset = REPORT_PRESETS.has(request.preset ?? "") ? request.preset! : "last7";
  if (request.from && request.to && ISO_DATE.test(request.from) && ISO_DATE.test(request.to)) {
    return { preset, from: request.from, to: request.to };
  }

  const now = new Date();
  const to = now.toISOString().split("T")[0]!;
  const start = new Date(now);
  if (preset === "last7") start.setDate(start.getDate() - 7);
  else if (preset === "last30") start.setDate(start.getDate() - 30);
  else if (preset === "thisMonth") start.setDate(1);
  const from = preset === "today" ? to : start.toISOString().split("T")[0]!;
  return { preset, from, to };
}

function reportDateRangeLabel(from: string, to: string) {
  if (from === to) {
    return new Date(`${from}T00:00:00`).toLocaleDateString("en-PH", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
  const start = new Date(`${from}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(`${to}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

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
      await (
        ctx.supabase as unknown as {
          rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
        }
      ).rpc("set_config", { setting: "app.current_staff_id", value: ctx.me.id, is_local: true });
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
  toDate: string,
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

// ── Reports workspace: one auth check and one retained-data payload ─────────
export async function getOwnerReportsDataAction(
  request: OwnerReportsRequest
): Promise<OwnerReportsResult> {
  const ctx = await requireOwner();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { preset, from, to } = reportRange(request);
  const trendDays =
    preset === "today"
      ? 0
      : preset === "last30"
        ? 30
        : preset === "thisMonth"
          ? Math.max(0, new Date().getDate() - 1)
          : 7;

  try {
    const [revenueData, staffData, trendData, cashSummary] = await Promise.all([
      getRevenueByBranch(from, to),
      getBookingsPerTherapist(from, to),
      getBookingTrend(trendDays),
      getCrossbranchCashSummary(from, to),
    ]);

    return {
      success: true,
      data: {
        preset,
        from,
        to,
        dateRangeLabel: reportDateRangeLabel(from, to),
        generatedAt: new Date().toISOString(),
        revenueData,
        staffData,
        trendData,
        cashSummary,
      },
    };
  } catch (error) {
    console.error("[owner/reports] analytics load failed", error);
    return { success: false, error: "Unable to load report data. Please try again." };
  }
}

// ── Payment-aware booking list for the new shared workspace ──────────────
// Uses the full-featured query that returns payment fields + branch resources.
export async function getOwnerWorkspaceBookingsAction(filters?: {
  date?: string;
  branchId?: string;
  status?: string;
  type?: string;
}) {
  const ctx = await requireOwner();
  if (!ctx) return { error: "Unauthorized" as const };
  const bookings = await getAllBookings({
    date: filters?.date,
    branchId: filters?.branchId,
    status: filters?.status,
    type: filters?.type,
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

  const {
    bookingId,
    paymentMethod,
    paymentStatus,
    amountPaid,
    paymentReference,
    paymentPurpose,
    reason,
  } = parsed.data;

  // Fetch current payment state for audit log
  const { data: before } = await ctx.supabase
    .from("bookings")
    .select(
      "branch_id, status, booking_progress_status, session_completed_at, payment_method, payment_status, amount_paid, payment_reference"
    )
    .eq("id", bookingId)
    .single();

  if (!before) {
    return { success: false, error: "Booking not found" };
  }

  const paymentGate = getBookingPaymentGate({
    bookingStatus: before.status,
    bookingProgressStatus: before.booking_progress_status,
    sessionCompletedAt: before.session_completed_at,
    previousAmountPaid: Number(before.amount_paid ?? 0),
    nextAmountPaid: amountPaid,
    nextPaymentStatus: paymentStatus,
    paymentPurpose,
    reason,
  });
  if (!paymentGate.allowed) {
    return { success: false, error: paymentGate.error };
  }

  const isSignificantChange =
    (before?.payment_status === "paid" && paymentStatus !== "paid") ||
    (before?.amount_paid ?? 0) > amountPaid;

  if (isSignificantChange && !reason?.trim()) {
    return { success: false, error: "Reason is required for voids, refunds, or corrections" };
  }

  // Insert audit log
  await ctx.supabase.from("booking_payment_logs").insert({
    booking_id: bookingId,
    changed_by: ctx.me.id ?? null,
    old_payment_method: before?.payment_method ?? null,
    old_payment_status: before?.payment_status ?? null,
    old_amount_paid: before?.amount_paid ?? null,
    old_payment_reference: before?.payment_reference ?? null,
    new_payment_method: paymentMethod,
    new_payment_status: paymentStatus,
    new_amount_paid: amountPaid,
    new_payment_reference: paymentReference ?? null,
    reason:
      paymentPurpose && paymentPurpose !== "final_settlement"
        ? `[${paymentPurpose}] ${reason?.trim() ?? ""}`.trim()
        : (reason?.trim() ?? null),
  });

  const { error } = await ctx.supabase
    .from("bookings")
    .update({
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
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
