import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ownerPreferenceAllows,
  pushFailureOutcome,
  subscriptionMatchesNotification,
} from "@/lib/notifications/push/delivery";

const notification = {
  id: "notification-1",
  branch_id: "branch-main",
  target_workspace: "crm",
  target_role: null,
  recipient_staff_id: null,
  actor_staff_id: null,
  type: "payment_pending",
  title: "New online booking",
  body: "Massage today",
  entity_type: "booking",
  entity_id: "booking-1",
  action_href: "/crm/bookings?bookingId=booking-1",
  priority: "high",
  status: "unread",
  requires_action: true,
  metadata: { delivery_type: "in_spa" },
  created_at: new Date().toISOString(),
  read_at: null,
  resolved_at: null,
  dedupe_key: "booking:1",
} as const;

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "subscription-1",
    auth_user_id: "user-1",
    staff_id: "staff-1",
    branch_id: "branch-main",
    workspace: "crm",
    endpoint: "https://push.example.test/device-1",
    p256dh: "p".repeat(80),
    auth_secret: "a".repeat(22),
    user_agent: null,
    device_label: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_success_at: null,
    last_failure_at: null,
    failure_count: 0,
    ...overrides,
  };
}

function staff(overrides: Record<string, unknown> = {}) {
  return {
    id: "staff-1",
    auth_user_id: "user-1",
    branch_id: "branch-main",
    system_role: "crm",
    is_active: true,
    ...overrides,
  };
}

describe("Web Push recipient targeting", () => {
  it("sends CRM notifications only to the same current branch", () => {
    expect(
      subscriptionMatchesNotification(
        subscription() as never,
        notification as never,
        staff() as never,
        "all"
      )
    ).toBe(true);
    expect(
      subscriptionMatchesNotification(
        subscription({ branch_id: "branch-sm" }) as never,
        notification as never,
        staff({ branch_id: "branch-sm" }) as never,
        "all"
      )
    ).toBe(false);
  });

  it("requires exact assigned recipient identity for staff and driver", () => {
    const assigned = {
      ...notification,
      target_workspace: "staff",
      recipient_staff_id: "staff-1",
      type: "booking_assigned",
    };
    expect(
      subscriptionMatchesNotification(
        subscription({ workspace: "staff" }) as never,
        assigned as never,
        staff({ system_role: "staff" }) as never,
        "all"
      )
    ).toBe(true);
    expect(
      subscriptionMatchesNotification(
        subscription({ workspace: "staff", staff_id: "staff-2" }) as never,
        assigned as never,
        staff({ id: "staff-2" }) as never,
        "all"
      )
    ).toBe(false);

    const driver = {
      ...assigned,
      target_workspace: "driver",
      recipient_staff_id: "driver-1",
    };
    expect(
      subscriptionMatchesNotification(
        subscription({ workspace: "driver", staff_id: "driver-1" }) as never,
        driver as never,
        staff({ id: "driver-1", system_role: "driver" }) as never,
        "all"
      )
    ).toBe(true);
  });

  it("respects all four Owner booking preferences", () => {
    const normal = { ...notification, priority: "normal" } as const;
    const home = {
      ...normal,
      type: "home_service_location_review",
      metadata: { delivery_type: "home_service" },
    } as const;
    expect(ownerPreferenceAllows("all", normal as never)).toBe(true);
    expect(ownerPreferenceAllows("home_service_and_urgent", normal as never)).toBe(false);
    expect(ownerPreferenceAllows("home_service_and_urgent", home as never)).toBe(true);
    expect(ownerPreferenceAllows("urgent_only", normal as never)).toBe(false);
    expect(ownerPreferenceAllows("urgent_only", notification as never)).toBe(true);
    expect(ownerPreferenceAllows("disabled", notification as never)).toBe(false);
  });

  it("rejects stale staff-less Owner subscriptions unless the account is a current super-admin", () => {
    const ownerNotification = {
      ...notification,
      target_workspace: "owner",
    };
    expect(
      subscriptionMatchesNotification(
        subscription({
          workspace: "owner",
          staff_id: null,
          branch_id: null,
          auth_user_id: "former-owner",
        }) as never,
        ownerNotification as never,
        undefined,
        "all"
      )
    ).toBe(false);
    expect(
      subscriptionMatchesNotification(
        subscription({
          workspace: "owner",
          staff_id: null,
          branch_id: null,
          auth_user_id: "6a185419-9a9f-45b5-967a-2f67db9b5d26",
        }) as never,
        ownerNotification as never,
        undefined,
        "all"
      )
    ).toBe(true);
  });

  it("deactivates 404/410 and repeated permanent failures without retry loops", () => {
    expect(pushFailureOutcome(0, 404)).toEqual({ failureCount: 1, deactivate: true });
    expect(pushFailureOutcome(0, 410)).toEqual({ failureCount: 1, deactivate: true });
    expect(pushFailureOutcome(0, 503)).toEqual({ failureCount: 1, deactivate: false });
    expect(pushFailureOutcome(4, 503)).toEqual({ failureCount: 5, deactivate: true });
  });
});
