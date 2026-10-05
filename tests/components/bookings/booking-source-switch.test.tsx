/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingSourceSwitch } from "@/components/features/bookings/booking-source-switch";

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/bookings",
  useSearchParams: () => new URLSearchParams("date=2026-10-05&search=Maria&status=confirmed"),
}));

afterEach(() => cleanup());

describe("booking source switch", () => {
  it("shows canonical source as selected and switches views without carrying workflow filters", () => {
    render(<BookingSourceSwitch source="cradlehub" />);
    expect(screen.getByRole("link", { name: "CradleHub" }).getAttribute("aria-current")).toBe(
      "page"
    );
    const sheet = screen.getByRole("link", { name: "Master Sheet" });
    expect(sheet.getAttribute("href")).toBe(
      "/crm/bookings?date=2026-10-05&search=Maria&referenceSource=master_sheet"
    );
    expect(screen.queryByRole("button", { name: /confirm|cancel|payment/i })).toBeNull();
  });
});
