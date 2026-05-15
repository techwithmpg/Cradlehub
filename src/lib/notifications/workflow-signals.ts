import "server-only";

import { createOrUpdateNotification, markNotificationResolved } from "./workflow-notifications-store";
import { createOrUpdateWorkflowTask, resolveWorkflowTask } from "./workflow-task-store";
import { buildNotificationDedupeKey } from "./workflow-dedupe";
import { logError } from "@/lib/logger";

export {
  buildNotificationDedupeKey,
  createOrUpdateNotification,
  createOrUpdateWorkflowTask,
  markNotificationResolved,
  resolveWorkflowTask,
};

type StaffOnboardingSubmittedEvent = {
  eventType: "staff_onboarding.submitted";
  requestId: string;
  branchId: string;
  applicantStaffId: string;
  applicantName: string;
  actorStaffId?: string | null;
  requestedServiceIds?: string[];
};

type StaffOnboardingReviewedEvent = {
  eventType: "staff_onboarding.approved" | "staff_onboarding.rejected";
  requestId: string;
  branchId: string | null;
  applicantStaffId: string | null;
  applicantName: string;
  actorStaffId?: string | null;
  rejectionReason?: string | null;
};
export type WorkflowSignalEvent =
  | StaffOnboardingSubmittedEvent
  | StaffOnboardingReviewedEvent;
const ONBOARDING_ENTITY_TYPE = "staff_onboarding_request";
const ONBOARDING_REVIEW_TASK = "staff_onboarding.review";

async function emitStaffOnboardingSubmitted(event: StaffOnboardingSubmittedEvent) {
  const missingServices = (event.requestedServiceIds ?? []).length === 0;

  await Promise.all([
    createOrUpdateWorkflowTask({
      branchId: event.branchId,
      workspaceScope: "manager",
      assignedToRole: "manager",
      taskType: ONBOARDING_REVIEW_TASK,
      title: "Review staff application",
      body: `${event.applicantName} completed onboarding and is waiting for approval.`,
      entityType: ONBOARDING_ENTITY_TYPE,
      entityId: event.requestId,
      actionHref: "/manager/staff/onboarding",
      priority: "high",
      metadata: {
        applicant_staff_id: event.applicantStaffId,
        applicant_name: event.applicantName,
        missing_requested_services: missingServices,
      },
    }),
    createOrUpdateNotification({
      branchId: event.branchId,
      targetWorkspace: "staff",
      targetRole: "staff",
      recipientStaffId: event.applicantStaffId,
      actorStaffId: event.actorStaffId ?? null,
      type: "staff_onboarding_submitted",
      title: "Application submitted",
      body: "Your staff application is waiting for review.",
      entityType: ONBOARDING_ENTITY_TYPE,
      entityId: event.requestId,
      actionHref: "/staff-portal",
      priority: "low",
      requiresAction: false,
      metadata: { signal_group: "updates" },
    }),
  ]);
}

async function resolveLegacyOnboardingNotifications(event: StaffOnboardingReviewedEvent) {
  await Promise.all([
    markNotificationResolved({
      entityType: ONBOARDING_ENTITY_TYPE,
      entityId: event.requestId,
      targetWorkspace: "owner",
      type: "staff_onboarding_submitted",
    }),
    markNotificationResolved({
      entityType: ONBOARDING_ENTITY_TYPE,
      entityId: event.requestId,
      targetWorkspace: "manager",
      type: "staff_onboarding_submitted",
    }),
    markNotificationResolved({
      entityType: ONBOARDING_ENTITY_TYPE,
      entityId: event.requestId,
      targetWorkspace: "manager",
      type: "staff_profile_incomplete",
    }),
  ]);
}

async function emitStaffOnboardingReviewed(event: StaffOnboardingReviewedEvent) {
  await Promise.all([
    resolveWorkflowTask({
      branchId: event.branchId,
      workspaceScope: "manager",
      assignedToRole: "manager",
      taskType: ONBOARDING_REVIEW_TASK,
      entityType: ONBOARDING_ENTITY_TYPE,
      entityId: event.requestId,
      completedByStaffId: event.actorStaffId ?? null,
    }),
    resolveLegacyOnboardingNotifications(event),
  ]);

  if (!event.applicantStaffId) return;

  const approved = event.eventType === "staff_onboarding.approved";
  await createOrUpdateNotification({
    branchId: event.branchId,
    targetWorkspace: "staff",
    targetRole: "staff",
    recipientStaffId: event.applicantStaffId,
    actorStaffId: event.actorStaffId ?? null,
    type: approved ? "staff_onboarding_approved" : "staff_onboarding_rejected",
    title: approved ? "Application approved" : "Application reviewed",
    body: approved
      ? "Your staff account is active."
      : event.rejectionReason?.trim() || "Your staff application was not approved.",
    entityType: ONBOARDING_ENTITY_TYPE,
    entityId: event.requestId,
    actionHref: approved ? "/staff-portal" : "/staff-onboarding",
    priority: approved ? "normal" : "low",
    requiresAction: false,
    metadata: { signal_group: "updates" },
  });
}

export async function emitWorkflowEvent(event: WorkflowSignalEvent): Promise<void> {
  try {
    if (event.eventType === "staff_onboarding.submitted") {
      await emitStaffOnboardingSubmitted(event);
      return;
    }
    await emitStaffOnboardingReviewed(event);
  } catch (error) {
    logError("workflow_signal.emit_failed", { eventType: event.eventType, error });
  }
}
