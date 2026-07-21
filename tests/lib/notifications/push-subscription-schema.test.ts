import { describe, expect, it } from "vitest";

import {
  notificationPreferencePatchSchema,
  pushEndpointSchema,
  pushSubscriptionSchema,
} from "@/lib/notifications/push/schemas";

describe("push API validation", () => {
  const valid = {
    endpoint: "https://push.example.test/subscription/abc",
    expirationTime: null,
    keys: {
      p256dh: "A".repeat(87),
      auth: "B".repeat(22),
    },
  };

  it("accepts a bounded HTTPS PushSubscription", () => {
    expect(pushSubscriptionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects external protocol, missing keys, and oversized values", () => {
    expect(
      pushSubscriptionSchema.safeParse({ ...valid, endpoint: "http://example.test" }).success
    ).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: valid.endpoint }).success).toBe(false);
    expect(
      pushEndpointSchema.safeParse({ endpoint: `https://example.test/${"x".repeat(5000)}` }).success
    ).toBe(false);
  });

  it("accepts only the documented Owner preference values", () => {
    for (const ownerBookingPreference of [
      "all",
      "home_service_and_urgent",
      "urgent_only",
      "disabled",
    ]) {
      expect(
        notificationPreferencePatchSchema.safeParse({ ownerBookingPreference }).success
      ).toBe(true);
    }
    expect(
      notificationPreferencePatchSchema.safeParse({ ownerBookingPreference: "everything" })
        .success
    ).toBe(false);
  });
});
