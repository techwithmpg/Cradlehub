"use client";

import { useEffect, useRef } from "react";

export const WORKSPACE_ENTITY_DELTA_EVENT = "cradlehub:entity-delta";
const BROADCAST_CHANNEL_NAME = "cradlehub:entity-delta-channel";

export type BookingEntityDelta = {
  id: string;
  branchId: string;
  bookingDate?: string;
  orderId?: string | null;
  status?: string;
  bookingProgressStatus?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  amountPaid?: number | null;
  staffId?: string | null;
  staffName?: string | null;
  resourceId?: string | null;
  resourceName?: string | null;
  startTime?: string;
  endTime?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  serviceName?: string | null;
  deliveryType?: string | null;
  totalAmount?: number | null;
};

export type FinancialPaymentDelta = {
  branchId: string;
  businessDate: string;
  transactionId: string;
  orderId?: string | null;
  bookingId?: string | null;
  amount: number;
  paymentMethod: string;
  customerName?: string;
  reference?: string;
  occurredAt: string;
};

export type AttendanceCheckinDelta = {
  branchId: string;
  checkinId: string;
  staffId: string;
  status: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  shiftDate?: string | null;
};

export type WorkspaceEntityDelta =
  | {
      kind: "booking.upserted";
      branchId: string;
      booking: BookingEntityDelta;
      timestamp: number;
    }
  | {
      kind: "booking.status_patched";
      branchId: string;
      booking: BookingEntityDelta;
      timestamp: number;
    }
  | {
      kind: "financial.payment_recorded";
      branchId: string;
      payment: FinancialPaymentDelta;
      timestamp: number;
    }
  | {
      kind: "attendance.checkin_patched";
      branchId: string;
      checkin: AttendanceCheckinDelta;
      timestamp: number;
    };

let sharedChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!sharedChannel) {
    try {
      sharedChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch {
      sharedChannel = null;
    }
  }
  return sharedChannel;
}

/**
 * Broadcasts a surgical entity delta to all mounted RetainedWorkspace modules
 * in the current tab (0ms synchronous CustomEvent) AND across other open browser tabs.
 */
export function emitWorkspaceEntityDelta(delta: WorkspaceEntityDelta): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WorkspaceEntityDelta>(WORKSPACE_ENTITY_DELTA_EVENT, { detail: delta }));
  try {
    getBroadcastChannel()?.postMessage(delta);
  } catch {
    // Ignore cross-tab broadcast errors
  }
}

/**
 * Subscribes a retained workspace module to surgical entity deltas for its branch
 * so it can patch its local React/SWR state in < 1ms without a full server reload.
 */
export function useWorkspaceEntityDelta(
  branchId: string | null | undefined,
  onDelta: (delta: WorkspaceEntityDelta) => void
): void {
  const handlerRef = useRef(onDelta);
  useEffect(() => {
    handlerRef.current = onDelta;
  }, [onDelta]);

  useEffect(() => {
    if (typeof window === "undefined" || !branchId) return;

    const handleDelta = (delta: WorkspaceEntityDelta | undefined) => {
      if (!delta || delta.branchId !== branchId) return;
      handlerRef.current(delta);
    };

    const onWindowEvent = (event: Event) => {
      handleDelta((event as CustomEvent<WorkspaceEntityDelta>).detail);
    };

    const channel = getBroadcastChannel();
    const onChannelMessage = (event: MessageEvent<WorkspaceEntityDelta>) => {
      handleDelta(event.data);
    };

    window.addEventListener(WORKSPACE_ENTITY_DELTA_EVENT, onWindowEvent);
    channel?.addEventListener("message", onChannelMessage);

    return () => {
      window.removeEventListener(WORKSPACE_ENTITY_DELTA_EVENT, onWindowEvent);
      channel?.removeEventListener("message", onChannelMessage);
    };
  }, [branchId]);
}
