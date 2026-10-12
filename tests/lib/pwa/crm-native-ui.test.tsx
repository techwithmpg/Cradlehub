// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffSafeMemoryProvider } from "@/components/features/staff-pwa/safe-memory";
import { CrmWorkList } from "@/components/features/staff-pwa/crm/crm-work-list";
import type { CrmMobileRuntime } from "@/lib/staff-pwa/crm-runtime";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const runtime: CrmMobileRuntime = {
  date: "2026-10-12",
  canViewBookings: true,
  bookingError: null,
  truncated: false,
  bookings: [
    {
      id: "a",
      branchId: "branch-a",
      date: "2026-10-12",
      time: "10:00:00",
      status: "confirmed",
      progress: "checked_in",
      deliveryType: "in_spa",
      customerName: "Maria",
      serviceName: "Massage",
    },
    {
      id: "b",
      branchId: "branch-a",
      date: "2026-10-13",
      time: "11:00:00",
      status: "confirmed",
      progress: "not_started",
      deliveryType: "home_service",
      customerName: "Ana",
      serviceName: "Home Service",
    },
  ],
};

afterEach(cleanup);

describe("CRM native work presentation", () => {
  it("keeps the filter in identity-scoped memory and offers no payment or booking mutation", () => {
    const view = render(
      <StaffSafeMemoryProvider identity="user-a:crm-a:branch-a">
        <CrmWorkList runtime={runtime} work={{ items: [], errors: [] }} />
      </StaffSafeMemoryProvider>
    );
    expect(screen.getByText("Maria")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Upcoming" }));
    expect(screen.getByText("Ana")).toBeDefined();
    expect(screen.queryByText("Maria")).toBeNull();

    view.rerender(
      <StaffSafeMemoryProvider identity="user-b:crm-b:branch-b">
        <CrmWorkList runtime={runtime} work={{ items: [], errors: [] }} />
      </StaffSafeMemoryProvider>
    );
    expect(screen.getByText("Maria")).toBeDefined();
    expect(screen.queryByRole("button", { name: /payment|check.?out|create booking/i })).toBeNull();
  });

  it("shows a read failure instead of a false empty list", () => {
    render(
      <CrmWorkList
        runtime={{ ...runtime, bookings: [], bookingError: "Booking schedule unavailable." }}
        work={{ items: [], errors: [] }}
      />
    );
    expect(screen.getByText("Booking schedule unavailable.")).toBeDefined();
    expect(screen.queryByText("No bookings in this view")).toBeNull();
  });
});
