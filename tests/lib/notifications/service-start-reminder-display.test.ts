import { describe, expect, it } from "vitest";
import { getNotificationDisplay } from "@/components/features/notifications/notification-display";
import type { WorkspaceNotification } from "@/lib/notifications/types";

describe("assigned therapist reminder display", () => {
  it("labels the two-minute notice as a treatment reminder, not a new booking request", () => {
    const notification = {
      id: "notice-1",
      type: "booking_status_changed",
      title: "Service starting soon",
      body: "Your assigned treatment starts at 2:00 PM.",
      target_workspace: "staff",
      entity_type: "booking",
      entity_id: "booking-1",
      action_href: "/staff-portal/service-progress",
      metadata: { service_start_reminder: true },
      status: "unread",
    } as unknown as WorkspaceNotification;
    const display = getNotificationDisplay(notification);
    expect(display.title).toBe("Service Starting Soon");
    expect(display.actionLabel).toBe("Open My Services");
    expect(display.href).toBe("/staff-portal/service-progress");
  });
});
