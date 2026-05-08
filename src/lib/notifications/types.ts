import type { Database } from "@/types/supabase";

export type WorkspaceNotification =
  Database["public"]["Tables"]["workspace_notifications"]["Row"];

export type NotificationType =
  | "staff_onboarding_submitted"
  | "staff_onboarding_approved"
  | "staff_onboarding_rejected"
  | "booking_created"
  | "booking_assigned"
  | "home_service_assigned"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_status_changed"
  | "customer_arrived"
  | "payment_pending"
  | "home_service_dispatch_conflict"
  | "waitlist_request_submitted"
  | "reconciliation_submitted"
  | "marketing_content_updated"
  | "system_warning"
  | "staff_progress_required";

export type NotificationWorkspace =
  | "owner"
  | "manager"
  | "crm"
  | "staff"
  | "driver"
  | "utility";

export type NotificationPriority = "low" | "normal" | "high" | "critical";
export type NotificationStatus = "unread" | "read" | "resolved" | "dismissed";

export type CreateNotificationInput = {
  branchId?: string | null;
  targetWorkspace: NotificationWorkspace;
  targetRole?: string | null;
  recipientStaffId?: string | null;
  actorStaffId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionHref?: string | null;
  priority?: NotificationPriority;
  requiresAction?: boolean;
  metadata?: Record<string, unknown>;
};
