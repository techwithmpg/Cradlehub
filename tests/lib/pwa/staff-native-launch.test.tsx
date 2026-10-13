// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  StaffSafeMemoryProvider,
  useStaffSafeMemory,
} from "@/components/features/staff-pwa/safe-memory";
import { getStaffPwaLaunchDestination } from "@/lib/auth/staff-pwa-launch";
import { staffPwaAttendanceHref } from "@/lib/staff-pwa/attendance-href";
import type { WorkspaceAccess } from "@/lib/auth/workspace-access";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/middleware", () => ({
  isSupabaseConfigured: () => false,
  updateSession: vi.fn(),
}));

const workspace = (key: WorkspaceAccess["key"]): WorkspaceAccess => ({
  key,
  label: key,
  description: "",
  href: `/${key}`,
  priority: 1,
});

function CacheProbe() {
  const cache = useStaffSafeMemory();
  const count = cache?.read("today")?.counts[0]?.value;
  return (
    <>
      <output data-testid="count">{count ?? "empty"}</output>
      <button
        onClick={() =>
          cache?.write({
            screen: "today",
            label: "Today",
            counts: [{ label: "Bookings", value: 2 }],
          })
        }
      >
        Record
      </button>
    </>
  );
}

describe("Staff native launch and safe memory", () => {
  it("keeps the manifest entry URL in scope and preserves ordinary slashless routes", async () => {
    const staff = await proxy(new NextRequest("https://local.example.invalid/staff?from=icon"));
    expect(staff.status).toBe(308);
    expect(staff.headers.get("location")).toBe("https://local.example.invalid/staff/?from=icon");
    const ordinary = await proxy(new NextRequest("https://local.example.invalid/login/"));
    expect(ordinary.status).toBe(308);
    expect(ordinary.headers.get("location")).toBe("https://local.example.invalid/login");
  });

  it("uses the Staff scope only when the verified operational group has its workspace", () => {
    expect(getStaffPwaLaunchDestination([workspace("staff_portal")], "provider")).toBe("/staff/");
    expect(getStaffPwaLaunchDestination([workspace("staff_portal")], "crm_general")).toBe(
      "/staff/"
    );
    expect(getStaffPwaLaunchDestination([workspace("driver")], "driver")).toBe("/staff/");
    expect(getStaffPwaLaunchDestination([workspace("utility")], "utility")).toBe("/staff/");
    expect(getStaffPwaLaunchDestination([workspace("owner")], null)).toBeNull();
    expect(getStaffPwaLaunchDestination([workspace("owner")], "provider")).toBeNull();
  });

  it("keeps supported Provider attendance links inside the installed scope", () => {
    expect(staffPwaAttendanceHref("/staff-portal/profile#attendance-phone")).toBe(
      "/staff/profile#attendance-phone"
    );
    expect(staffPwaAttendanceHref("/staff-portal/schedule")).toBe("/staff/schedule");
    expect(staffPwaAttendanceHref("/staff-portal/attendance")).toBe("/staff/attendance");
    expect(staffPwaAttendanceHref("/staff-portal/unknown")).toBe("/staff-portal/unknown");
  });

  it("does not show a prior identity's summary after staff or branch changes", () => {
    const view = render(
      <StaffSafeMemoryProvider identity="user-a:staff-a:therapist:branch-a">
        <CacheProbe />
      </StaffSafeMemoryProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(screen.getByTestId("count").textContent).toBe("2");
    view.rerender(
      <StaffSafeMemoryProvider identity="user-b:staff-b:therapist:branch-b">
        <CacheProbe />
      </StaffSafeMemoryProvider>
    );
    expect(screen.getByTestId("count").textContent).toBe("empty");
  });
});
