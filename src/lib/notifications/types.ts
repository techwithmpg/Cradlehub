import type { Database } from "@/types/supabase";

export type WorkspaceNotification =
  Database["public"]["Tables"]["workspace_notifications"]["Row"];

export type WorkflowTask =
  Database["public"]["Tables"]["workflow_tasks"]["Row"];

export type NotificationType =
  | "staff_onboarding_submitted"
  | "staff_onboarding_approved"
  | "staff_onboarding_rejected"
  | "booking_created"
  | "booking_assigned"
  | "home_service_assigned"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_reassigned"
  | "booking_status_changed"
  | "customer_arrived"
  | "payment_pending"
  | "payment_overdue"
  | "home_service_dispatch_conflict"
  | "home_service_location_review"
  | "staff_schedule_exception"
  | "waitlist_request_submitted"
  | "reconciliation_submitted"
  | "service_setup_warning"
  | "branch_setup_warning"
  | "resource_conflict_warning"
  | "staff_availability_conflict"
  | "marketing_content_updated"
  | "system_warning"
  | "staff_progress_required"
  | "staff_profile_incomplete"
  | "staff_capabilities_pending"
  | "staff_capabilities_confirmed"
  | "staff_therapist_level_missing"
  | "schedule_suggestion_approved"
  | "schedule_suggestion_rejected"
  | "schedule_block_applied"
  | "attendance_device_registration_requested"
  | "attendance_device_registration_approved"
  | "attendance_device_registration_rejected"
  | "attendance_device_registration_completed";

export type NotificationWorkspace =
  | "owner"
  | "manager"
  | "crm"
  | "staff"
  | "driver"
  | "utility";

export type NotificationPriority = "low" | "normal" | "high" | "critical";
export type NotificationStatus = "unread" | "read" | "resolved" | "dismissed";
export type WorkflowTaskStatus = "open" | "in_progress" | "completed" | "cancelled";

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
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateWorkflowTaskInput = {
  branchId?: string | null;
  workspaceScope: NotificationWorkspace;
  assignedToStaffId?: string | null;
  assignedToRole?: string | null;
  taskType: string;
  title: string;
  body?: string | null;
  entityType: string;
  entityId: string;
  actionHref?: string | null;
  priority?: NotificationPriority;
  dueAt?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type ResolveWorkflowTaskInput = {
  branchId?: string | null;
  workspaceScope: NotificationWorkspace;
  assignedToStaffId?: string | null;
  assignedToRole?: string | null;
  taskType: string;
  entityType: string;
  entityId: string;
  completedByStaffId?: string | null;
  status?: Extract<WorkflowTaskStatus, "completed" | "cancelled">;
  dedupeKey?: string | null;
};

export type MarkNotificationResolvedInput = {
  branchId?: string | null;
  targetWorkspace?: NotificationWorkspace | null;
  targetRole?: string | null;
  recipientStaffId?: string | null;
  type?: NotificationType | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
};

export type NotificationDedupeInput = {
  branchId?: string | null;
  workspaceScope: NotificationWorkspace;
  recipientStaffId?: string | null;
  recipientRole?: string | null;
  eventType?: string | null;
  taskType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};
