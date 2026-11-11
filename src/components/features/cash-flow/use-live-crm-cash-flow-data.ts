"use client";

import { useCallback } from "react";
import { refreshCrmCashFlowWorkspaceAction } from "@/lib/actions/crm-cash-flow-data-actions";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { useWorkspaceEntityDelta } from "@/lib/workspace/entity-delta-bus";
import {
  crmCashFlowRequestKey,
  type CrmCashFlowWorkspacePayload,
} from "./crm-cash-flow-workspace-data";

export function useLiveCrmCashFlowData(fallback: CrmCashFlowWorkspacePayload) {
  const request = fallback.request;
  const requestKey = crmCashFlowRequestKey(request);

  const fetcher = useCallback(
    () => refreshCrmCashFlowWorkspaceAction(request),
    [request]
  );

  const live = useGenerationAwareWorkspaceSWR<CrmCashFlowWorkspacePayload>(
    "crm-cash-flow",
    requestKey,
    fetcher,
    fallback
  );

  const { patchData } = live;

  // Surgically patch Cash Flow when a service completes or a payment is recorded
  useWorkspaceEntityDelta(fallback.data.branchId, (delta) => {
    if (delta.kind === "booking.status_patched" || delta.kind === "booking.upserted") {
      const b = delta.booking;
      const isCompleted =
        b.status === "completed" || b.bookingProgressStatus === "completed";
      if (!isCompleted) return;

      patchData((current) => {
        const matchesOrder = (order: (typeof current.data.payableOrders)[number]) =>
          Boolean(
            (b.orderId && order.id === b.orderId) ||
              order.id === b.id ||
              order.payableItems?.some((item) => item.bookingId === b.id)
          );

        const orderMatches = current.data.payableOrders.some(matchesOrder);
        if (!orderMatches) return current;

        return {
          ...current,
          data: {
            ...current.data,
            payableOrders: current.data.payableOrders.map((order) =>
              matchesOrder(order)
                ? {
                    ...order,
                    readyForCheckout: true,
                  }
                : order
            ),
          },
        };
      });
    } else if (delta.kind === "financial.payment_recorded") {
      const p = delta.payment;
      patchData((current) => {
        const updatedPayable = current.data.payableOrders
          .map((order) => {
            const matchesPayment = Boolean(
              (p.orderId && order.id === p.orderId) ||
                (p.bookingId &&
                  (order.id === p.bookingId ||
                    order.payableItems?.some((item) => item.bookingId === p.bookingId)))
            );
            if (matchesPayment) {
              const nextBalance = Math.max(0, order.remainingBalance - p.amount);
              return {
                ...order,
                amountPaid: order.amountPaid + p.amount,
                remainingBalance: nextBalance,
                paymentStatus: (nextBalance <= 0 ? "paid" : "partially_paid") as
                  | "paid"
                  | "partially_paid",
              };
            }
            return order;
          })
          .filter((order) => order.remainingBalance > 0);

        return {
          ...current,
          data: {
            ...current.data,
            payableOrders: updatedPayable,
          },
        };
      });
    }
  });

  return live;
}
