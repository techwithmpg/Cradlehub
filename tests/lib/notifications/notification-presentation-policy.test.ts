import { describe, expect, it } from "vitest";
import {
  canDismissNotification,
  shouldPresentActionPopup,
} from "@/lib/notifications/presentation-policy";

describe("N3 notification presentation and dismissal policy", () => {
  it("presents only newly unread high/critical actionable work", () => {
    const row = { status: "unread" as const, requires_action: true, priority: "high" as const };
    expect(shouldPresentActionPopup(row)).toBe(true);
    expect(shouldPresentActionPopup({ ...row, priority: "critical" })).toBe(true);
    expect(shouldPresentActionPopup({ ...row, priority: "normal" })).toBe(false);
    expect(shouldPresentActionPopup({ ...row, requires_action: false })).toBe(false);
    expect(shouldPresentActionPopup({ ...row, status: "read" })).toBe(false);
    expect(shouldPresentActionPopup({ ...row, status: "resolved" })).toBe(false);
    expect(shouldPresentActionPopup({ ...row, status: "dismissed" })).toBe(false);
  });

  it("never lets an individual dismiss a shared unresolved action", () => {
    expect(canDismissNotification({ requires_action: true, status: "unread" })).toBe(false);
    expect(canDismissNotification({ requires_action: true, status: "read" })).toBe(false);
    expect(canDismissNotification({ requires_action: false, status: "unread" })).toBe(true);
    expect(canDismissNotification({ requires_action: false, status: "read" })).toBe(true);
    expect(canDismissNotification({ requires_action: false, status: "resolved" })).toBe(false);
  });
});
