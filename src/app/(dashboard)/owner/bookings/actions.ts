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
import { recordBookingPaymentChange } from "@/lib/bookings/payment-transaction";
import { getCrossbranchCashSummary } from "@/lib/queries/analytics";
import { fetchOwnerReportsData } from "@/lib/queries/owner-reports";
import type {
  OwnerReportsRequest,
  OwnerReportsResult,
  MasterSheetEvidenceSummary,
} from "@/lib/owner/reports";
import { projectOwnerSheetEvidence } from "@/lib/owner/sheet-report-projection";
import { loadMasterSheetReview } from "@/lib/integrations/google-sheets/sheet-review-service";
import { resolveConfiguredWorkbookSources } from "@/lib/integrations/google-sheets/workbook-source-map";

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

  try {
    const data = await fetchOwnerReportsData(request);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[owner/reports] analytics load failed", error);
    return { success: false, error: "Unable to load report data. Please try again." };
  }
}

// Independent resource: Google latency or failure never holds up canonical reports.
export async function getOwnerReportSheetEvidenceAction(scope: {
  branchId: string;
  from: string;
  to: string;
}): Promise<MasterSheetEvidenceSummary> {
  const ctx = await requireOwner();
  if (!ctx) throw new Error("Unauthorized");
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!validDate(scope.from) || !validDate(scope.to) || scope.from > scope.to)
    throw new Error("Invalid report range");
  const { data: branches, error } = await ctx.supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true);
  if (error) throw new Error("Unable to resolve report branch");
  if (scope.branchId !== "all" && !(branches ?? []).some((b) => b.id === scope.branchId)) {
    throw new Error("Invalid report branch");
  }
  const sources = resolveConfiguredWorkbookSources(branches ?? []);
  const selectedSources = sources.filter(
    (source) => scope.branchId === "all" || scope.branchId === source.branchId
  );
  if (selectedSources.length === 0) return projectOwnerSheetEvidence(null, null, scope);
  const started = performance.now();
  const projectedSources = await Promise.all(
    selectedSources.map(async (source) =>
      projectOwnerSheetEvidence(
        await loadMasterSheetReview({ workbookId: source.workbookId }),
        source,
        scope
      )
    )
  );
  const first = projectedSources[0]!;
  const projected: MasterSheetEvidenceSummary =
    projectedSources.length === 1
      ? first
      : {
          ...first,
          status: projectedSources.some((item) => item.status === "available")
            ? "available"
            : "unavailable",
          coverage: projectedSources.every((item) => item.coverage === "FULL_COVERAGE")
            ? "FULL_COVERAGE"
            : "PARTIAL_COVERAGE",
          coverageFrom: projectedSources
            .map((item) => item.coverageFrom)
            .filter((value): value is string => Boolean(value))
            .sort()[0],
          coverageTo: projectedSources
            .map((item) => item.coverageTo)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1),
          sourceWorkbook: projectedSources
            .map((item) => item.sourceWorkbook)
            .filter(Boolean)
            .join(", "),
          mappedBranch: projectedSources
            .map((item) => item.mappedBranch)
            .filter(Boolean)
            .join(", "),
          scopeNote: projectedSources.some((item) => item.status !== "available")
            ? "One or more configured Master Sheet sources are unavailable; evidence amounts are incomplete."
            : scope.branchId === "all" && selectedSources.length < (branches ?? []).length
              ? "External evidence covers configured branches only; All Branches canonical scope is broader."
              : "External evidence covers the configured provisional source mappings.",
          totalRecords: projectedSources.reduce((sum, item) => sum + item.totalRecords, 0),
          visitCount: projectedSources.reduce((sum, item) => sum + item.visitCount, 0),
          dutyCount: projectedSources.reduce((sum, item) => sum + item.dutyCount, 0),
          needsReviewCount: projectedSources.reduce((sum, item) => sum + item.needsReviewCount, 0),
          evidenceAmount: projectedSources.reduce((sum, item) => sum + item.evidenceAmount, 0),
          amountKnownCount: projectedSources.reduce(
            (sum, item) => sum + (item.amountKnownCount ?? 0),
            0
          ),
          amountUnknownCount: projectedSources.reduce(
            (sum, item) => sum + (item.amountUnknownCount ?? 0),
            0
          ),
          recentVisits: projectedSources.flatMap((item) => item.recentVisits ?? []),
          recentReviews: projectedSources.flatMap((item) => item.recentReviews ?? []),
          sources: projectedSources.flatMap((item) => item.sources ?? []),
        };
  console.info("[owner/reports] sheet evidence projection", {
    status: projected.status,
    coverage: projected.coverage,
    projectionAndReadMs: Math.round(performance.now() - started),
  });
  return projected;
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
// The explicit payment RPC posts any new money and updates the booking atomically.
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
    financialAccountId,
    payments,
    idempotencyKey,
    businessDate,
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

  const paymentResult = await recordBookingPaymentChange(ctx.supabase, {
    bookingId,
    branchId: null,
    paymentMethod,
    paymentStatus,
    amountPaid,
    paymentReference,
    reason:
      paymentPurpose && paymentPurpose !== "final_settlement"
        ? `[${paymentPurpose}] ${reason?.trim() ?? ""}`.trim()
        : (reason?.trim() ?? null),
    financialAccountId,
    payments,
    idempotencyKey,
    businessDate,
  });
  if (!paymentResult.ok) return { success: false, error: paymentResult.error };

  revalidatePath("/owner");
  revalidatePath("/owner/bookings");
  revalidatePath("/owner/reports");
  revalidatePath("/crm/cash-flow");
  if (before?.branch_id) {
    invalidateTag(cacheTags.ownerWorkspace(before.branch_id));
    invalidateTag(cacheTags.crmWorkspace(before.branch_id));
  }
  return { success: true, warning: paymentResult.reconciliationWarning ?? undefined };
}
