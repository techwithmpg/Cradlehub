/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BookingSourceSwitch,
  sourceSwitchDates,
} from "@/components/features/bookings/booking-source-switch";

const route = vi.hoisted(() => ({ params: "date=2026-10-05&search=Maria&status=confirmed" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/bookings",
  useSearchParams: () => new URLSearchParams(route.params),
}));

afterEach(() => {
  cleanup();
  route.params = "date=2026-10-05&search=Maria&status=confirmed";
});

describe("booking source switch", () => {
  it("shows canonical source as selected and switches views without carrying workflow filters", () => {
    render(<BookingSourceSwitch source="cradlehub" />);
    expect(screen.getByRole("link", { name: "CradleHub" }).getAttribute("aria-current")).toBe(
      "page"
    );
    const sheet = screen.getByRole("link", { name: "Master Sheet" });
    expect(sheet.getAttribute("href")).toBe(
      "/crm/bookings?date=2026-10-05&search=Maria&cradlehubDate=2026-10-05&referenceSource=master_sheet"
    );
    expect(screen.queryByRole("button", { name: /confirm|cancel|payment/i })).toBeNull();
  });

  it("uses the current supported Sheet day and restores the canonical future day", () => {
    expect(sourceSwitchDates("2026-10-16", "2026-10-13")).toEqual({
      sheetDate: "2026-10-13",
      cradlehubDate: "2026-10-16",
    });
    expect(sourceSwitchDates("2026-10-13", "2026-10-13", "2026-10-16")).toEqual({
      sheetDate: "2026-10-13",
      cradlehubDate: "2026-10-16",
    });
  });

  it("preserves a selected date within the loaded Sheet window", () => {
    expect(sourceSwitchDates("2026-10-12", "2026-10-13").sheetDate).toBe("2026-10-12");
  });
});
