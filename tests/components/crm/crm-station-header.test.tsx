// @vitest-environment jsdom
import React from "react";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CrmStationControlBar } from "@/components/features/crm/station/crm-station-control-bar";

const { channel, pathname } = vi.hoisted(() => ({ channel: vi.fn(), pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathname, useRouter: () => ({}) }));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => {
    const query = {
      data: [],
      select: () => query, eq: () => query, order: () => query, limit: () => query,
    };
    return { from: () => query, channel, removeChannel: vi.fn() };
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function renderStation(desktop: boolean, route = "/crm/today") {
  pathname.mockReturnValue(route);
  channel.mockReturnValue({ on: () => ({ subscribe: vi.fn() }) });
  vi.stubGlobal("matchMedia", () => ({
    matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  return render(
    <>
      <header><div id="crm-station-header" /></header>
      <main>
        <CrmStationControlBar branchId="selected-branch" branchName="Selected branch"
          currentStaffName="Test operator" role="owner" />
      </main>
    </>,
  );
}

it.each([true, false])("renders a single station for the selected CRM branch (desktop=%s)", (desktop) => {
  const view = renderStation(desktop);
  expect(within(view.getByRole(desktop ? "banner" : "main")).getByRole("group", {
    name: "Active PC Station Role",
  })).toBeDefined();
  expect(view.getAllByRole("group", { name: "Active PC Station Role" })).toHaveLength(1);
  expect(channel).toHaveBeenCalledWith("crm-shift-handover-selected-branch");
});

it("keeps the wallboard free of station subscriptions", () => {
  const view = renderStation(true, "/crm/live-operations");
  expect(view.queryByRole("group", { name: "Active PC Station Role" })).toBeNull();
  expect(channel).not.toHaveBeenCalled();
});
