import { deriveOrderPaymentEligibility } from "@/lib/cash-flow/order-payment-eligibility";
import { canConfirmPayments } from "@/lib/auth/crm-permissions";
import { NextRequest } from "next/server";
import {
  withDesktopCashierContext,
  desktopJson,
  desktopFailure,
} from "@/lib/cashier/desktop-cashier-contract";
import {
  PostOrderPaymentPayloadSchema,
  isPaymentMethodCompatibleWithAccount,
  FinancialPaymentMethod,
  FinancialAccountType,
} from "@/lib/cash-flow/financial-contract";
import { recordOrderPayment } from "@/lib/cash-flow/payment-writer";
import { recordLegacyBookingPaymentDomain } from "@/lib/cash-flow/legacy-payment-writer";
import { isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";

export async function POST(request: NextRequest) {
  return withDesktopCashierContext(request, async (ctx) => {
    const staffRole = ctx.operator.staffRole ?? ctx.operator.staff?.system_role ?? "";
    if (!staffRole || !canConfirmPayments(staffRole)) {
      return desktopFailure("FORBIDDEN", `Staff role '${staffRole}' is not authorized to record payments.`, 403);
    }

    if (staffRole !== "owner" && ctx.operator.staff?.branch_id && ctx.operator.staff.branch_id !== ctx.branchId) {
      return desktopFailure("BRANCH_MISMATCH", "Cannot record payment for a branch you are not assigned to.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return desktopFailure("INVALID_JSON", "Invalid JSON in request body.", 400);
    }

    const parsed = PostOrderPaymentPayloadSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join("; ");
      return desktopFailure("VALIDATION_ERROR", errorMsg, 400);
    }

    const payload = parsed.data;

    // Verify account types compatibility
    const accountIds = payload.payments.map((p) => p.financialAccountId);
    const { data: accounts, error: accountsError } = await ctx.supabase
      .from("financial_accounts")
      .select("id, account_type, branch_id, is_active")
      .in("id", accountIds);

    if (accountsError || !accounts) {
      return desktopFailure("ACCOUNTS_LOOKUP_FAILED", "Failed to verify payment accounts.", 500);
    }

    type AccRecord = { id: string; account_type: string; branch_id: string | null; is_active: boolean };
    const accountMap = new Map<string, AccRecord>((accounts as AccRecord[]).map((a: AccRecord) => [a.id, a]));

    for (const tender of payload.payments) {
      const acc = accountMap.get(tender.financialAccountId);
      if (!acc) {
        return desktopFailure("ACCOUNT_NOT_FOUND", "Payment account was not found.", 400);
      }
      if (!acc.is_active) {
        return desktopFailure("ACCOUNT_INACTIVE", "Payment account is inactive.", 400);
      }
      if (acc.branch_id && acc.branch_id !== ctx.branchId) {
        return desktopFailure("ACCOUNT_WRONG_BRANCH", "Payment account does not belong to branch.", 403);
      }
      if (!isPaymentMethodCompatibleWithAccount(tender.paymentMethod as FinancialPaymentMethod, acc.account_type as FinancialAccountType)) {
        return desktopFailure(
          "ACCOUNT_INCOMPATIBLE",
          `Payment method ${tender.paymentMethod} is incompatible with account type ${acc.account_type}.`,
          400
        );
      }
    }

    // 1. Check if payload.orderId is a booking_orders row
    const { data: order, error: orderError } = await ctx.supabase
      .from("booking_orders")
      .select("id, branch_id")
      .eq("id", payload.orderId)
      .maybeSingle();

    if (orderError) {
      return desktopFailure("DATABASE_ERROR", orderError.message, 500);
    }

    if (order) {
      if (order.branch_id !== ctx.branchId) {
        return desktopFailure("BRANCH_MISMATCH", "Cannot record payment for an order in another branch.", 403);
      }

      // Enforce order payment eligibility on the server if child bookings exist
      let orderBookings: Array<{ id: string; status: string | null; metadata: Record<string, unknown> | null }> | null = null;
      try {
        const bookingsRes = await ctx.supabase
          .from("bookings")
          .select("id, status, metadata")
          .eq("order_id", order.id);
        if (bookingsRes && Array.isArray(bookingsRes.data)) {
          orderBookings = bookingsRes.data as unknown as Array<{ id: string; status: string | null; metadata: Record<string, unknown> | null }>;
        }
      } catch {
        orderBookings = null;
      }

      if (orderBookings && orderBookings.length > 0) {
        let orderItems: Array<{
          id: string;
          booking_id: string | null;
          amount: number | string;
          charge_type: string;
          source_type: string | null;
          source_id: string | null;
          sequence: number;
        }> = [];
        try {
          const itemsRes = await ctx.supabase
            .from("order_payable_items")
            .select("id, booking_id, amount, charge_type, sequence, source_type, source_id")
            .eq("order_id", order.id)
            .order("sequence");
          if (itemsRes && Array.isArray(itemsRes.data)) {
            orderItems = itemsRes.data;
          }
        } catch {
          orderItems = [];
        }

        const { data: orderSummary } = await ctx.supabase
          .from("v_booking_order_financial_summaries")
          .select("total_payable, net_allocated")
          .eq("order_id", order.id)
          .maybeSingle();

        const { data: orderMeta } = await ctx.supabase
          .from("booking_orders")
          .select("metadata")
          .eq("id", order.id)
          .maybeSingle();

        const eligibility = deriveOrderPaymentEligibility({
          children: orderBookings.map((b) => ({
            id: b.id,
            status: b.status,
            metadata: b.metadata as Record<string, unknown> | null,
          })),
          items: orderItems.map((i) => ({
            id: i.id,
            booking_id: i.booking_id,
            amount: Number(i.amount) || 0,
            charge_type: i.charge_type,
            source_type: i.source_type,
            source_id: i.source_id,
            sequence: i.sequence,
          })),
          totalPayable: Number(orderSummary?.total_payable ?? 0),
          netAllocated: Number(orderSummary?.net_allocated ?? 0),
          quotedTotal: Number((orderMeta?.metadata as Record<string, unknown> | null)?.total_amount) || null,
          homeServiceFee: (orderMeta?.metadata as Record<string, unknown> | null)?.home_service_fee,
        });

        if (eligibility && !eligibility.eligible) {
          return desktopFailure("ORDER_INELIGIBLE", "This order is not currently eligible for payment collection.", 400);
        }
      }

      // Call authoritative atomic writer
      const result = await recordOrderPayment(ctx.supabase, payload);

      if (!result.ok) {
        return desktopFailure(result.code || "PAYMENT_REJECTED", result.error, 400);
      }

      if (!result.data.success) {
        return desktopFailure("PAYMENT_REJECTED", "Payment posting was rejected by server.", 400);
      }

      return desktopJson({
        ok: true,
        data: result.data,
      });
    }

    // 2. Fallback: check if payload.orderId is a legacy booking without order_id
    const { data: legacyBooking, error: legacyError } = await ctx.supabase
      .from("bookings")
      .select("id, branch_id, order_id, amount_paid, payment_status, status, metadata")
      .eq("id", payload.orderId)
      .maybeSingle();

    if (legacyError) {
      return desktopFailure("DATABASE_ERROR", legacyError.message, 500);
    }

    if (legacyBooking) {
      if (legacyBooking.order_id !== null) {
        return desktopFailure("SOURCE_MISMATCH", "Use the order payment command for this booking.", 400);
      }
      if (legacyBooking.branch_id !== ctx.branchId) {
        return desktopFailure("BRANCH_MISMATCH", "Cannot record payment for a booking in another branch.", 403);
      }
      if (isBookingClosedForCrm(String(legacyBooking.status ?? ""))) {
        return desktopFailure("BOOKING_NOT_PAYABLE", "This booking is closed and cannot receive payment.", 400);
      }

      const legacyResult = await recordLegacyBookingPaymentDomain(
        ctx.supabase,
        {
          bookingId: legacyBooking.id,
          branchId: ctx.branchId,
          expectedAmountPaid: Number(legacyBooking.amount_paid ?? 0),
          idempotencyKey: payload.idempotencyKey,
          payments: payload.payments,
          businessDate: String(payload.businessDate ?? ctx.businessDate),
          notes: payload.notes ?? null,
        },
        {
          userId: ctx.authUserId,
          role: staffRole,
          staffId: ctx.operator.staff?.id ?? undefined,
          branchId: ctx.operator.staff?.branch_id ?? undefined,
        }
      );

      if (!legacyResult.ok) {
        return desktopFailure(legacyResult.code || "PAYMENT_REJECTED", legacyResult.error, 400);
      }

      return desktopJson({
        ok: true,
        data: legacyResult.data,
      });
    }

    return desktopFailure("ORDER_NOT_FOUND", "Order or booking was not found.", 404);
  });
}
