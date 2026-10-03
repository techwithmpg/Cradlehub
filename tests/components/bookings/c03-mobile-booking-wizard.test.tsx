/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

import { QuickBookingForm } from "@/components/features/bookings/quick-booking-form";

describe("C-03: Mobile New Booking Wizard Responsive Layout", () => {
  afterEach(cleanup);

  const defaultProps = {
    branchId: "branch-1",
    branchName: "CradleHub QC",
    initialMode: "walkin" as const,
    services: [
      {
        id: "svc-1",
        name: "Swedish Massage",
        durationMinutes: 60,
        price: 800,
        availableInSpa: true,
        availableHomeService: true,
      },
    ],
    staff: [
      {
        id: "staff-1",
        name: "Therapist Anna",
        nickname: "Anna",
        serviceIds: ["svc-1"],
      },
    ],
    bookingRules: {
      inSpaStartTime: "10:00",
      inSpaEndTime: "22:30",
      homeServiceEnabled: true,
      homeServiceStartTime: "14:30",
      homeServiceEndTime: "22:00",
      maxAdvanceBookingDays: 30,
    },
    resources: [
      {
        id: "res-1",
        name: "Room A",
        is_active: true,
      },
    ],
  };

  it("renders the wizard container with flex column on mobile and grid on desktop", () => {
    const { container } = render(<QuickBookingForm {...defaultProps} />);

    // The scrollable split container
    const scrollContainer = container.querySelector(".flex.min-h-0.flex-1.flex-col.overflow-y-auto");
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.className).toContain("lg:grid");
    expect(scrollContainer?.className).toContain("lg:grid-cols-[minmax(0,1fr)_340px]");
    expect(scrollContainer?.className).toContain("lg:overflow-hidden");
  });

  it("ensures form column uses min-w-0 for mobile containment and lg:min-h-0 on desktop", () => {
    const { container } = render(<QuickBookingForm {...defaultProps} />);

    // Form column
    const formCol = container.querySelector(".min-w-0.px-4");
    expect(formCol).not.toBeNull();
    expect(formCol?.className).toContain("lg:min-h-0");
    expect(formCol?.className).toContain("lg:overflow-y-auto");
  });

  it("ensures summary aside uses min-w-0 and lg:min-h-0 without overlapping form controls", () => {
    const { container } = render(<QuickBookingForm {...defaultProps} />);

    // Aside summary
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain("min-w-0");
    expect(aside?.className).toContain("border-t");
    expect(aside?.className).toContain("lg:min-h-0");
    expect(aside?.className).toContain("lg:border-l");
    expect(aside?.className).toContain("lg:border-t-0");
    expect(aside?.className).toContain("lg:overflow-y-auto");
  });

  it("renders all core booking controls reachable and readable on mobile", () => {
    render(<QuickBookingForm {...defaultProps} />);

    // 1. Booking mode buttons
    expect(screen.getByRole("button", { name: /^walk-in/i })).toBeDefined();

    // 2. Customer control
    expect(screen.getByPlaceholderText(/search name or phone number/i)).toBeDefined();

    // 3. Service controls
    expect(screen.getByText("Search and select one or more services.")).toBeDefined();

    // 4. Date & Time controls
    expect(screen.getByLabelText(/choose next available time/i)).toBeDefined();

    // 5. Provider / Therapist control (present in form and summary)
    expect(screen.getAllByText(/^Therapist$/i).length).toBeGreaterThanOrEqual(1);

    // 6. Room control (in-spa)
    expect(screen.getAllByText(/^Room$/i).length).toBeGreaterThanOrEqual(1);

    // 7. Summary panel readable
    expect(screen.getByText(/^Summary$/i)).toBeDefined();

    // 8. Bottom actions pinned in footer
    expect(screen.getByRole("button", { name: /save walk-in/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
  });
});
