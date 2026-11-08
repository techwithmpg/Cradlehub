import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const bell = source("src/components/features/notifications/notification-bell.tsx");
const hook = source("src/components/features/notifications/use-workspace-notification-realtime.ts");
const queries = source("src/lib/notifications/queries.ts");
const layout = source("src/app/(dashboard)/layout.tsx");

describe("N3 popup safety contracts", () => {
  it("closes the toast locally rather than mutating branch-wide state", () => {
    expect(bell).toContain('label: "Close"');
    expect(bell).toContain("toast.dismiss(notification.id)");
    expect(bell).not.toContain("dismissNotificationAction(notification.id)");
    expect(bell).toContain("shouldPresentActionPopup(notification)");
    expect(bell).toContain("deferredRef.current.set(notification.id, notification)");
    expect(bell).toContain('notification.status === "resolved" || notification.status === "dismissed"');
  });
  it("server dismiss only permits nonactionable active updates", () => {
    const dismiss = queries.slice(queries.indexOf("export async function dismissNotificationAction("));
    expect(dismiss).toContain('.eq("requires_action", false)');
    expect(dismiss).toContain('.in("status", ["unread", "read"])');
    const markAll = queries.slice(
      queries.indexOf("export async function markAllNotificationsReadAction("),
      queries.indexOf("export async function dismissNotificationAction(")
    );
    expect(markAll).toContain('.eq("requires_action", false)');
  });
  it("isolates popup history by logged-in user and workspace", () => {
    expect(hook).toContain("presentationScope");
    expect(hook).toContain("handledKey");
    expect(hook).toContain("browserKey");
    expect(layout).toContain("userId={ctx.user.id}");
  });
});
