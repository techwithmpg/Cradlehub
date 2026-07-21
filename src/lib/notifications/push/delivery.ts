import "server-only";

import webpush from "web-push";

import { canonicalizeSystemRole } from "@/constants/staff";
import { isSuperAdmin } from "@/lib/auth/super-admin";
import { logError, logInfo, logWarn } from "@/lib/logger";
import {
  getNotificationTargetPath,
  resolveNotificationHref,
  type NotificationWorkspaceContext,
} from "@/lib/notifications/notification-targets";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { getWebPushConfiguration, isWebPushConfigured } from "./config";
import type { OwnerBookingPreference } from "./schemas";

type PushSubscriptionRow =
  Database["public"]["Tables"]["web_push_subscriptions"]["Row"];

type StaffScope = {
  auth_user_id: string | null;
  branch_id: string;
  id: string;
  is_active: boolean;
  system_role: string;
};

export type PushDeliveryResult = {
  attempted: number;
  delivered: number;
  failed: number;
  deactivated: number;
};

const BOOKING_TYPES = new Set([
  "booking_created",
  "booking_assigned",
  "home_service_assigned",
  "booking_cancelled",
  "booking_rescheduled",
  "booking_reassigned",
  "booking_status_changed",
  "customer_arrived",
  "payment_pending",
  "payment_overdue",
  "home_service_dispatch_conflict",
  "home_service_location_review",
  "staff_schedule_exception",
]);

function isBookingNotification(notification: WorkspaceNotification) {
  return (
    notification.entity_type === "booking" ||
    BOOKING_TYPES.has(notification.type)
  );
}

function isHomeServiceNotification(notification: WorkspaceNotification) {
  if (notification.type.startsWith("home_service_")) return true;
  const metadata =
    notification.metadata &&
    typeof notification.metadata === "object" &&
    !Array.isArray(notification.metadata)
      ? (notification.metadata as Record<string, unknown>)
      : {};
  return (
    metadata.delivery_type === "home_service" ||
    metadata.booking_type === "home_service" ||
    metadata.is_home_service === true
  );
}

export function ownerPreferenceAllows(
  preference: OwnerBookingPreference,
  notification: WorkspaceNotification
) {
  if (!isBookingNotification(notification)) return true;
  if (preference === "disabled") return false;
  if (preference === "all") return true;
  const urgent =
    notification.priority === "critical" || notification.priority === "high";
  if (preference === "urgent_only") return urgent;
  return urgent || isHomeServiceNotification(notification);
}

function workspaceMatchesStaff(
  subscription: PushSubscriptionRow,
  staff: StaffScope | undefined
) {
  if (subscription.workspace === "owner" && !subscription.staff_id) {
    return isSuperAdmin(subscription.auth_user_id);
  }
  if (!staff || !staff.is_active || staff.auth_user_id !== subscription.auth_user_id) {
    return false;
  }
  const role = canonicalizeSystemRole(staff.system_role);
  if (subscription.workspace === "crm") return role === "crm";
  return role === subscription.workspace;
}

export function subscriptionMatchesNotification(
  subscription: PushSubscriptionRow,
  notification: WorkspaceNotification,
  staff: StaffScope | undefined,
  ownerPreference: OwnerBookingPreference
) {
  if (!workspaceMatchesStaff(subscription, staff)) return false;

  if (subscription.workspace === "owner") {
    const ownerRelevant =
      notification.target_workspace === "owner" ||
      notification.priority === "critical" ||
      isBookingNotification(notification);
    return ownerRelevant && ownerPreferenceAllows(ownerPreference, notification);
  }

  if (subscription.workspace !== notification.target_workspace) return false;
  if (!notification.branch_id || subscription.branch_id !== notification.branch_id) {
    return false;
  }
  if (staff?.branch_id !== subscription.branch_id) return false;
  if (
    notification.recipient_staff_id &&
    notification.recipient_staff_id !== subscription.staff_id
  ) {
    return false;
  }
  if (
    ["staff", "driver", "utility"].includes(subscription.workspace) &&
    (!notification.recipient_staff_id ||
      notification.recipient_staff_id !== subscription.staff_id)
  ) {
    return false;
  }
  if (notification.target_role) {
    return canonicalizeSystemRole(notification.target_role) ===
      canonicalizeSystemRole(staff?.system_role ?? "");
  }
  return true;
}

function safeActionHref(
  notification: WorkspaceNotification,
  workspace: PushSubscriptionRow["workspace"]
) {
  const context = workspace as NotificationWorkspaceContext;
  return (
    resolveNotificationHref({
      ...notification,
      target_workspace: workspace,
    }) ??
    getNotificationTargetPath({
      workspace: context,
      entityType: notification.entity_type,
      entityId: notification.entity_id,
    })
  );
}

function pushPayload(
  notification: WorkspaceNotification,
  subscription: PushSubscriptionRow
) {
  return JSON.stringify({
    notificationId: notification.id,
    title: notification.title.slice(0, 120),
    body: (notification.body ?? "Open CradleHub to view this update.").slice(0, 280),
    actionHref: safeActionHref(notification, subscription.workspace),
    tag: `cradlehub-notification:${notification.id}`,
    priority: notification.priority,
    icon: "/icon.png",
    badge: "/icon.png",
  });
}

function statusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : null;
}

export function pushFailureOutcome(
  currentFailureCount: number,
  responseCode: number | null
) {
  const failureCount = currentFailureCount + 1;
  return {
    failureCount,
    deactivate:
      responseCode === 404 || responseCode === 410 || failureCount >= 5,
  };
}

async function recordSuccess(subscription: PushSubscriptionRow) {
  const admin = createAdminClient();
  await admin
    .from("web_push_subscriptions")
    .update({
      last_success_at: new Date().toISOString(),
      failure_count: 0,
    })
    .eq("id", subscription.id);
}

async function recordFailure(
  subscription: PushSubscriptionRow,
  responseCode: number | null
) {
  const outcome = pushFailureOutcome(subscription.failure_count, responseCode);
  const admin = createAdminClient();
  await admin
    .from("web_push_subscriptions")
    .update({
      last_failure_at: new Date().toISOString(),
      failure_count: outcome.failureCount,
      ...(outcome.deactivate ? { is_active: false } : {}),
    })
    .eq("id", subscription.id);
  return outcome.deactivate;
}

export async function sendWebPushToSubscription(input: {
  subscription: PushSubscriptionRow;
  payload: string;
  priority: WorkspaceNotification["priority"];
}) {
  const config = getWebPushConfiguration();
  return webpush.sendNotification(
    {
      endpoint: input.subscription.endpoint,
      keys: {
        p256dh: input.subscription.p256dh,
        auth: input.subscription.auth_secret,
      },
    },
    input.payload,
    {
      TTL: input.priority === "critical" ? 86_400 : 3_600,
      urgency:
        input.priority === "critical"
          ? "high"
          : input.priority === "high"
            ? "normal"
            : "low",
      timeout: 8_000,
      vapidDetails: {
        subject: config.subject,
        publicKey: config.publicKey,
        privateKey: config.privateKey,
      },
    }
  );
}

export async function deliverWorkspaceNotificationPush(
  notification: WorkspaceNotification
): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = {
    attempted: 0,
    delivered: 0,
    failed: 0,
    deactivated: 0,
  };
  if (!isWebPushConfigured()) {
    logWarn("notification.push_skipped_unconfigured", {
      notificationId: notification.id,
      workspace: notification.target_workspace,
    });
    return result;
  }

  try {
    const admin = createAdminClient();
    const candidateWorkspaces = ["owner"];
    if (
      ["crm", "staff", "driver", "utility"].includes(
        notification.target_workspace
      )
    ) {
      candidateWorkspaces.push(notification.target_workspace);
    }
    const subscriptionsResult = await admin
      .from("web_push_subscriptions")
      .select("*")
      .eq("is_active", true)
      .in("workspace", [...new Set(candidateWorkspaces)]);
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    const subscriptions = subscriptionsResult.data ?? [];
    if (!subscriptions.length) return result;

    const staffIds = subscriptions
      .map((subscription) => subscription.staff_id)
      .filter((id): id is string => Boolean(id));
    const staffResult = staffIds.length
      ? await admin
          .from("staff")
          .select("id, auth_user_id, branch_id, system_role, is_active")
          .in("id", staffIds)
      : { data: [] as StaffScope[], error: null };
    if (staffResult.error) throw staffResult.error;
    const staffById = new Map(
      (staffResult.data as StaffScope[]).map((staff) => [staff.id, staff])
    );

    const ownerIds = subscriptions
      .filter((subscription) => subscription.workspace === "owner")
      .map((subscription) => subscription.auth_user_id);
    const preferenceResult = ownerIds.length
      ? await admin
          .from("notification_delivery_preferences")
          .select("auth_user_id, owner_booking_preference")
          .in("auth_user_id", ownerIds)
      : { data: [], error: null };
    if (preferenceResult.error) throw preferenceResult.error;
    const ownerPreferences = new Map(
      (preferenceResult.data ?? []).map((preference) => [
        preference.auth_user_id,
        preference.owner_booking_preference as OwnerBookingPreference,
      ])
    );

    const eligible = subscriptions.filter((subscription) =>
      subscriptionMatchesNotification(
        subscription,
        notification,
        subscription.staff_id
          ? staffById.get(subscription.staff_id)
          : undefined,
        ownerPreferences.get(subscription.auth_user_id) ??
          "home_service_and_urgent"
      )
    );
    result.attempted = eligible.length;

    await Promise.all(
      eligible.map(async (subscription) => {
        try {
          const response = await sendWebPushToSubscription({
            subscription,
            payload: pushPayload(notification, subscription),
            priority: notification.priority,
          });
          await recordSuccess(subscription);
          result.delivered += 1;
          logInfo("notification.push_delivered", {
            notificationId: notification.id,
            subscriptionId: subscription.id,
            workspace: subscription.workspace,
            resultCode: response.statusCode,
          });
        } catch (error) {
          const responseCode = statusCode(error);
          const deactivated = await recordFailure(subscription, responseCode);
          result.failed += 1;
          if (deactivated) result.deactivated += 1;
          logError("notification.push_failed", {
            notificationId: notification.id,
            subscriptionId: subscription.id,
            workspace: subscription.workspace,
            resultCode: responseCode,
            deactivated,
            errorName: error instanceof Error ? error.name : "UnknownPushError",
          });
        }
      })
    );
  } catch (error) {
    logError("notification.push_dispatch_failed", {
      notificationId: notification.id,
      workspace: notification.target_workspace,
      errorName: error instanceof Error ? error.name : "UnknownPushError",
    });
  }

  return result;
}
