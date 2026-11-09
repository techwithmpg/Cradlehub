/** Carries the authoritative count to the existing CRM bell (presentation only). */
export const PENDING_CRM_QUEUE_EVENT = "cradlehub:pending-crm-queue";

export type PendingCrmQueueEvent = {
  count: number;
  onDuty: boolean;
  checkedAt: string;
};

export function broadcastPendingCrmQueue(event: PendingCrmQueueEvent) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<PendingCrmQueueEvent>(PENDING_CRM_QUEUE_EVENT, { detail: event }));
  }
}
