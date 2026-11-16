import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverWorkspaceNotificationPush } from "@/lib/notifications/push/delivery";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { attendanceV2Enabled } from "@/lib/attendance/v2-server";
import { logError } from "@/lib/logger";

type PushJob = {
  notification_id: string;
  lease_token: string;
  delivered_subscription_ids: string[];
};

export async function processAttendanceV2() {
  const admin = createAdminClient();
  if (!(await attendanceV2Enabled(admin))) return { inactive: true };
  const due = await admin.rpc("process_due_attendance_v2" as never, { p_batch_size: 50 } as never);
  if (due.error) throw due.error;
  const claimed = await admin.rpc("claim_attendance_v2_push" as never, { p_limit: 20 } as never);
  if (claimed.error) throw claimed.error;
  let failed = 0;
  let accepted = 0;
  const jobs = (claimed.data ?? []) as PushJob[];
  // Small batches bound network work; leased endpoints are never sent in parallel twice.
  for (let offset = 0; offset < jobs.length; offset += 3) {
    await Promise.all(
      jobs.slice(offset, offset + 3).map(async (job) => {
        let complete = false;
        let errorCode: string | null = null;
        let delivered: string[] = [];
        try {
          const result = await admin
            .from("workspace_notifications")
            .select("*")
            .eq("id", job.notification_id)
            .maybeSingle();
          if (result.error) throw result.error;
          const notice = result.data as WorkspaceNotification | null;
          if (!notice || notice.status !== "unread") {
            errorCode = "notice_resolved";
          } else {
            const state = await admin
              .from("staff_shift_checkins")
              .select("status, checked_out_at")
              .eq("id", notice.entity_id!)
              .maybeSingle();
            if (state.error) throw state.error;
            if (state.data?.status !== "checked_in" || state.data.checked_out_at) {
              errorCode = "attendance_closed";
            } else {
              const eligible = await admin.rpc(
                "validate_attendance_v2_push" as never,
                {
                  p_notification_id: job.notification_id,
                  p_lease_token: job.lease_token,
                } as never
              );
              if (eligible.error) throw eligible.error;
              if (eligible.data !== true) {
                errorCode = "work_or_deadline_changed";
              } else {
                const delivery = await deliverWorkspaceNotificationPush(notice, {
                  skipSubscriptionIds: new Set(job.delivered_subscription_ids),
                  eligibleStaffIds: new Set([notice.recipient_staff_id!]),
                  validatedAttendanceRecipient: notice.recipient_staff_id!,
                });
                delivered = delivery.deliveredSubscriptionIds;
                complete =
                  delivery.configured &&
                  !delivery.dispatchFailed &&
                  delivery.failed === 0 &&
                  (delivery.attempted > 0 || job.delivered_subscription_ids.length > 0);
                if (!complete)
                  errorCode = !delivery.configured
                    ? "push_unconfigured"
                    : delivery.attempted === 0
                      ? "no_push_endpoint"
                      : "push_failed";
              }
            }
          }
        } catch {
          errorCode = "push_dispatch_exception";
        }
        const finished = await admin.rpc(
          "finish_attendance_v2_push" as never,
          {
            p_notification_id: job.notification_id,
            p_lease_token: job.lease_token,
            p_delivered: delivered,
            p_complete: complete,
            p_error: errorCode,
          } as never
        );
        if (finished.error || finished.data !== true) {
          failed += 1;
          logError("attendance.v2.push_finish_failed", { notificationId: job.notification_id });
        } else if (complete) accepted += 1;
        else failed += 1;
      })
    );
  }
  return {
    processing: due.data,
    push: { claimed: jobs.length, providerAccepted: accepted, failed },
  };
}
