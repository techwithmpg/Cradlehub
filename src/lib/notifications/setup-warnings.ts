import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";

async function notifyOwnerAndManager(input: {
  branchId: string;
  type: "service_setup_warning" | "branch_setup_warning" | "system_warning";
  title: string;
  body: string;
  priority: "normal" | "high" | "critical";
}) {
  await Promise.all([
    createNotification({
      branchId: input.branchId,
      targetWorkspace: "owner",
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: "branch",
      entityId: input.branchId,
      actionHref: `/owner/branches/${input.branchId}`,
      priority: input.priority,
      requiresAction: true,
    }),
    createNotification({
      branchId: input.branchId,
      targetWorkspace: "manager",
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: "branch",
      entityId: input.branchId,
      actionHref: "/manager/settings",
      priority: input.priority,
      requiresAction: true,
    }),
  ]);
}

export async function ensureBranchSetupWarningNotifications(branchId: string) {
  const rules = await getBranchBookingRulesOrDefault(branchId);
  if (!rules.homeServiceEnabled) return;

  const admin = createAdminClient();
  const { data: eligibleHomeServices, error } = await admin
    .from("branch_services")
    .select("id")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .eq("available_home_service", true)
    .limit(1);

  if (!error && (eligibleHomeServices ?? []).length === 0) {
    await notifyOwnerAndManager({
      branchId,
      type: "service_setup_warning",
      title: "Home Service has no eligible services",
      body: "Home Service is enabled for this branch, but no active branch services are marked available for Home Service.",
      priority: "high",
    });
  } else {
    await Promise.all([
      resolveNotificationsForEntity("branch", branchId, "owner", "service_setup_warning"),
      resolveNotificationsForEntity("branch", branchId, "manager", "service_setup_warning"),
    ]);
  }

  if (rules.homeServiceDriverCapacity === 0) {
    await notifyOwnerAndManager({
      branchId,
      type: "branch_setup_warning",
      title: "Home Service driver capacity is zero",
      body: "Home Service is enabled, but driver capacity is set to zero.",
      priority: "critical",
    });
  } else {
    await Promise.all([
      resolveNotificationsForEntity("branch", branchId, "owner", "branch_setup_warning"),
      resolveNotificationsForEntity("branch", branchId, "manager", "branch_setup_warning"),
    ]);
  }

  if (!process.env.GOOGLE_MAPS_SERVER_API_KEY) {
    await createNotification({
      branchId,
      targetWorkspace: "owner",
      type: "system_warning",
      title: "Google Maps setup needs attention",
      body: "Home Service dispatch is enabled, but the server-side Google Maps key is not configured.",
      entityType: "branch",
      entityId: branchId,
      actionHref: `/owner/branches/${branchId}`,
      priority: "high",
      requiresAction: true,
    });
  } else {
    await resolveNotificationsForEntity("branch", branchId, "owner", "system_warning");
  }
}
