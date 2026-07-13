import { describe, expect, it } from "vitest";
import { getNotificationDisplay } from "@/components/features/notifications/notification-display";
import type { WorkspaceNotification } from "@/lib/notifications/types";

describe("staff schedule exception notification", () => {
  it("renders as an amber booking review with booking context", () => {
    const notification = {
      type: "staff_schedule_exception",
      title: "Staff schedule exception",
      body: "The customer selected Maria, but the booking extends beyond the scheduled shift.",
      action_href: "/crm/bookings?bookingId=booking-1",
      priority: "high",
      status: "unread",
      metadata: {
        customer_name: "Ana Cruz",
        booking_date: "2026-07-14",
        start_time: "17:30:00",
        branch_name: "Main Spa",
      },
    } as unknown as WorkspaceNotification;

    expect(getNotificationDisplay(notification)).toMatchObject({
      title: "Staff Schedule Exception",
      detail: "Ana Cruz",
      meta: "2026-07-14, 17:30:00 · Main Spa",
      actionLabel: "View Booking",
      tone: "warning",
      iconName: "warning",
      href: "/crm/bookings?bookingId=booking-1",
    });
  });
});
