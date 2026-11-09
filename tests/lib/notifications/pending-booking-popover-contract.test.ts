import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bell = readFileSync("src/components/features/notifications/notification-bell.tsx", "utf8");
const popover = readFileSync("src/components/features/notifications/notification-popover.tsx", "utf8");

describe("P1 pending booking notification bell integration contract", () => {
  it("declares the count prop that NotificationBell passes to the dropdown alias", () => {
    expect(popover).toContain("pendingCrmCount?: number | null;");
    expect(popover).toContain("pendingCrmCount = null,");
    expect(bell).toContain("pendingCrmCount={pendingCrmQueue?.onDuty ? pendingCrmQueue.count : 0}");
  });

  it("shows one grouped doorway only when an authenticated on-duty queue has multiple pending bookings", () => {
    expect(popover).toContain("smartPendingBookings &&");
    expect(popover).toContain('role === "crm"');
    expect(popover).toContain("Number.isSafeInteger(pendingCrmCount)");
    expect(popover).toContain("pendingCrmCount > 1");
    expect(popover).toContain("const hasPendingGroup = groupedPendingCount > 1;");
    expect(popover).toContain("const bookingReviewItems = hasPendingGroup");
    expect(popover).toContain("{hasPendingGroup ? (");
    expect(popover).toContain("{groupedPendingCount} bookings awaiting confirmation");
    expect(popover).toContain('href="/crm/bookings?tab=needs-action"');
  });

  it("preserves the original notifications and their non-destructive actions", () => {
    expect(popover).toContain("const displayedItems = orderedItems.filter");
    expect(popover).toContain("onMarkRead={() => onMarkRead(item.id)}");
    expect(popover).toContain("onDismiss={() => onDismiss(item.id)}");
    expect(popover).not.toContain("update({ status:");
  });
});
