import { describe, expect, it } from "vitest";
import {
  NAV_CONFIG,
  resolveWorkspaceKeyFromRole,
} from "@/components/features/dashboard/nav-config";

describe("workspace navigation contract", () => {
  it("shows exactly one Staff Attendance destination", () => {
    const attendanceItems = NAV_CONFIG.staff?.items?.filter(
      (item) => item.href === "/staff-portal/attendance"
    );

    expect(attendanceItems).toEqual([
      {
        label: "My Attendance",
        href: "/staff-portal/attendance",
        icon: "ClipboardCheck",
      },
    ]);
  });

  it("keeps the Manager workspace paused and management roles routed to CRM", () => {
    expect(NAV_CONFIG.manager?.mvpHidden).toBe(true);
    expect(resolveWorkspaceKeyFromRole("manager")).toBe("crm");
    expect(resolveWorkspaceKeyFromRole("assistant_manager")).toBe("crm");
    expect(resolveWorkspaceKeyFromRole("store_manager")).toBe("crm");
  });
});
