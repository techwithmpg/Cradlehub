import "server-only";

import {
  generateDeviceRecoveryLink,
  type GenerateDeviceRecoveryInput,
} from "@/lib/attendance/device-recovery";
import type { AttendanceActionContext } from "@/lib/attendance/queries";
import type { RecoveryLinkResult } from "@/lib/attendance/types";
import { createOrUpdateNotification } from "@/lib/notifications/workflow-notifications-store";

/**
 * Shared CRM operation for Attendance phone recovery.
 *
 * This is intentionally above the token-generation service because
 * Staff Profile delivery has an authoritative notification side effect.
 *
 * Web Server Actions and Desktop bearer APIs must both call this function
 * so that recovery behavior does not diverge between clients.
 */
export async function generateAttendanceDeviceRecoveryOperation(params: {
  ctx: AttendanceActionContext;
  input: GenerateDeviceRecoveryInput;
  origin?: string | null;
}): Promise<RecoveryLinkResult> {
  const input: GenerateDeviceRecoveryInput = {
    ...params.input,
    branchId: params.ctx.branchId,
  };

  const recovery = await generateDeviceRecoveryLink({
    ctx: params.ctx,
    input,
    origin: params.origin,
  });

  if (recovery.deliveryMethod === "staff_profile") {
    await createOrUpdateNotification({
      branchId: params.ctx.branchId,
      targetWorkspace: "staff",
      recipientStaffId: input.staffId,
      actorStaffId: params.ctx.actorStaffId,
      type: "attendance_device_recovery_ready",
      title: "Connect your Attendance browser",
      body: "CRM sent a secure browser connection request. Open this on the phone you want to use and tap Connect this browser now.",
      entityType: "attendance_device_recovery",
      entityId: recovery.tokenId,
      actionHref: "/staff-portal/profile#attendance-phone",
      priority: "high",
      requiresAction: true,
      dedupeKey: `attendance-profile-recovery:${recovery.tokenId}`,
      metadata: {
        tokenId: recovery.tokenId,
        reason: input.reason,
        deliveryMethod: "staff_profile",
      },
    });
  }

  return recovery;
}
