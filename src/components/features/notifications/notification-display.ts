import { resolveNotificationHref } from "@/lib/notifications/notification-targets";
import type { WorkspaceNotification } from "@/lib/notifications/types";

export type NotificationTone =
  | "booking"
  | "payment"
  | "staff"
  | "setup"
  | "schedule"
  | "waitlist"
  | "warning"
  | "info"
  | "success";

export type NotificationDisplay = {
  title: string;
  detail: string;
  meta?: string;
  actionLabel: string;
  tone: NotificationTone;
  href: string;
  iconName:
    | "calendar"
    | "user"
    | "payment"
    | "settings"
    | "warning"
    | "users"
    | "info";
};

const BOOKING_TYPES = new Set([
  "booking_created",
  "booking_assigned",
  "home_service_assigned",
  "booking_status_changed",
  "booking_cancelled",
  "booking_rescheduled",
  "booking_reassigned",
  "customer_arrived",
  "home_service_location_review",
  "home_service_dispatch_conflict",
]);

const PAYMENT_TYPES = new Set(["payment_pending", "payment_overdue"]);

const STAFF_TYPES = new Set([
  "staff_onboarding_submitted",
  "staff_onboarding_approved",
  "staff_onboarding_rejected",
  "staff_profile_incomplete",
  "staff_capabilities_pending",
  "staff_capabilities_confirmed",
  "staff_therapist_level_missing",
  "staff_progress_required",
]);

const SETUP_TYPES = new Set([
  "service_setup_warning",
  "branch_setup_warning",
  "resource_conflict_warning",
  "system_warning",
]);

const SCHEDULE_TYPES = new Set([
  "staff_availability_conflict",
  "schedule_suggestion_approved",
  "schedule_suggestion_rejected",
  "schedule_block_applied",
]);

function readString(
  metadata: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function compactJoin(parts: Array<string | undefined>, separator = " · "): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(separator);
}

function titleSubject(title: string): string | undefined {
  const [, subject] = title.match(/[—-]\s*(.+)$/) ?? [];
  return subject?.trim() || undefined;
}

function safeTitle(notification: WorkspaceNotification, fallback: string): string {
  return notification.title?.trim() || fallback;
}

function safeDetail(notification: WorkspaceNotification, fallback = "Open to view details"): string {
  return notification.body?.trim() || fallback;
}

function metadataObject(
  value: WorkspaceNotification["metadata"]
): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resolvedHref(notification: WorkspaceNotification): string {
  return resolveNotificationHref(notification) ?? notification.action_href ?? "/";
}

function bookingTime(metadata: Record<string, unknown>): string | undefined {
  const date = readString(metadata, [
    "booking_date",
    "bookingDate",
    "date",
    "target_date",
    "targetDate",
  ]);
  const time = readString(metadata, [
    "booking_time",
    "bookingTime",
    "start_time",
    "startTime",
    "preferred_time",
    "preferredTime",
  ]);
  if (date && time) return `${date}, ${time}`;
  return date ?? time;
}

function formattedAmount(metadata: Record<string, unknown>): string | undefined {
  const raw = readString(metadata, [
    "balance",
    "amount",
    "amount_due",
    "amountDue",
    "payment_amount",
    "paymentAmount",
  ]);
  if (!raw) return undefined;

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;

  return `₱${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
  }).format(numeric)}`;
}

function bookingDisplay(notification: WorkspaceNotification): NotificationDisplay {
  const metadata = metadataObject(notification.metadata);
  const customer =
    readString(metadata, ["customer_name", "customerName", "customer", "full_name", "fullName"]) ??
    titleSubject(notification.title);
  const service = readString(metadata, ["service_name", "serviceName", "service"]);
  const branch = readString(metadata, ["branch_name", "branchName", "branch"]);
  const time = bookingTime(metadata);
  const detail = compactJoin([customer, service]) || safeDetail(notification);
  const meta = compactJoin([time, branch]);
  const title =
    notification.type === "home_service_location_review"
      ? "Location Review"
      : notification.type === "home_service_dispatch_conflict"
        ? "Dispatch Conflict"
        : notification.type === "customer_arrived"
          ? "Customer Arrived"
          : "Booking Request";

  return {
    title,
    detail,
    meta: meta || undefined,
    actionLabel: "View Booking",
    tone:
      notification.type === "home_service_dispatch_conflict" ||
      notification.type === "home_service_location_review"
        ? "warning"
        : "booking",
    href: resolvedHref(notification),
    iconName:
      notification.type === "home_service_dispatch_conflict" ||
      notification.type === "home_service_location_review"
        ? "warning"
        : "calendar",
  };
}

function paymentDisplay(notification: WorkspaceNotification): NotificationDisplay {
  const metadata = metadataObject(notification.metadata);
  const customer =
    readString(metadata, ["customer_name", "customerName", "customer", "full_name", "fullName"]) ??
    titleSubject(notification.title);
  const amount = formattedAmount(metadata);
  const time = bookingTime(metadata);
  const detail = compactJoin([customer, amount]) || safeDetail(notification);

  return {
    title: notification.type === "payment_overdue" ? "Payment Overdue" : "Payment Pending",
    detail,
    meta: time,
    actionLabel: "Confirm Payment",
    tone: "payment",
    href: resolvedHref(notification),
    iconName: "payment",
  };
}

function staffDisplay(notification: WorkspaceNotification): NotificationDisplay {
  const metadata = metadataObject(notification.metadata);
  const staffName =
    readString(metadata, [
      "staff_name",
      "staffName",
      "applicant_name",
      "applicantName",
      "applicant",
    ]) ?? titleSubject(notification.title);
  const status = readString(metadata, ["status", "review_status", "reviewStatus"]);
  const branch = readString(metadata, ["branch_name", "branchName", "branch"]);
  const detail = staffName ? compactJoin([staffName, status]) : safeDetail(notification);
  const needsReview =
    notification.type === "staff_onboarding_submitted" ||
    notification.type === "staff_capabilities_pending" ||
    notification.type === "staff_profile_incomplete";

  return {
    title:
      notification.type === "staff_onboarding_approved" ||
      notification.type === "staff_capabilities_confirmed"
        ? "Staff Update"
        : "Staff Onboarding",
    detail,
    meta: branch,
    actionLabel: needsReview ? "Review" : "Open Staff",
    tone:
      notification.type === "staff_onboarding_approved" ||
      notification.type === "staff_capabilities_confirmed"
        ? "success"
        : "staff",
    href: resolvedHref(notification),
    iconName: "user",
  };
}

function setupDisplay(notification: WorkspaceNotification): NotificationDisplay {
  const metadata = metadataObject(notification.metadata);
  const affected = readString(metadata, [
    "affected_count",
    "affectedCount",
    "count",
    "services_count",
    "servicesCount",
  ]);
  const area = readString(metadata, ["area", "where", "branch_name", "branchName", "branch"]);
  const detail = affected ? compactJoin([`${affected} affected`, safeDetail(notification)]) : safeDetail(notification);

  return {
    title: notification.type === "system_warning" ? "System Warning" : "Setup Warning",
    detail,
    meta: area,
    actionLabel: "Fix Now",
    tone: notification.priority === "critical" ? "warning" : "setup",
    href: resolvedHref(notification),
    iconName: notification.priority === "critical" ? "warning" : "settings",
  };
}

function scheduleDisplay(notification: WorkspaceNotification): NotificationDisplay {
  const metadata = metadataObject(notification.metadata);
  const staffName = readString(metadata, ["staff_name", "staffName", "staff"]);
  const time = bookingTime(metadata);
  const issue = readString(metadata, ["issue", "update", "reason"]);
  const detail = compactJoin([staffName, issue]) || safeDetail(notification);

  return {
    title:
      notification.type === "schedule_suggestion_approved" ||
      notification.type === "schedule_block_applied"
        ? "Schedule Update"
        : "Schedule Warning",
    detail,
    meta: time,
    actionLabel: "Open Schedule",
    tone:
      notification.type === "schedule_suggestion_approved" ||
      notification.type === "schedule_block_applied"
        ? "success"
        : "schedule",
    href: resolvedHref(notification),
    iconName: "calendar",
  };
}

function waitlistDisplay(notification: WorkspaceNotification): NotificationDisplay {
  const metadata = metadataObject(notification.metadata);
  const customer =
    readString(metadata, ["customer_name", "customerName", "customer"]) ??
    titleSubject(notification.title);
  const service = readString(metadata, ["service_name", "serviceName", "service"]);
  const preferred = compactJoin(
    [
      readString(metadata, ["preferred_date", "preferredDate"]),
      readString(metadata, ["preferred_time", "preferredTime"]),
    ],
    ", "
  );
  const detail = compactJoin([customer, service]) || safeDetail(notification);

  return {
    title: "Waitlist Request",
    detail,
    meta: preferred || undefined,
    actionLabel: "View Request",
    tone: "waitlist",
    href: resolvedHref(notification),
    iconName: "users",
  };
}

export function getNotificationDisplay(
  notification: WorkspaceNotification
): NotificationDisplay {
  if (BOOKING_TYPES.has(notification.type)) return bookingDisplay(notification);
  if (PAYMENT_TYPES.has(notification.type)) return paymentDisplay(notification);
  if (STAFF_TYPES.has(notification.type)) return staffDisplay(notification);
  if (SETUP_TYPES.has(notification.type)) return setupDisplay(notification);
  if (SCHEDULE_TYPES.has(notification.type)) return scheduleDisplay(notification);
  if (notification.type === "waitlist_request_submitted") return waitlistDisplay(notification);

  return {
    title: safeTitle(notification, "Notification"),
    detail: safeDetail(notification),
    actionLabel: "View",
    tone: notification.status === "resolved" ? "success" : "info",
    href: resolvedHref(notification),
    iconName: notification.priority === "critical" ? "warning" : "info",
  };
}
