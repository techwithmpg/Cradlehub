// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuickBookingServiceSelector } from "@/components/features/bookings/quick-booking-service-selector";
import type { QuickBookingServiceOption } from "@/components/features/bookings/quick-booking-form";

const services: QuickBookingServiceOption[] = Array.from({ length: 10 }, (_, index) => ({
  id: `service-${index + 1}`,
  name: `Service ${String(index + 1).padStart(2, "0")}`,
  price: 500 + index,
  durationMinutes: 60,
  availableInSpa: true,
  availableHomeService: true,
  categoryId: index % 2 ? "b" : "a",
  categoryName: index % 2 ? "Category B" : "Category A",
}));

function SelectorFixture() {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  return (
    <QuickBookingServiceSelector
      services={services}
      selectedServiceIds={selectedServiceIds}
      onChange={setSelectedServiceIds}
      isHomeService={false}
    />
  );
}

afterEach(cleanup);

describe("Quick Booking service carousel", () => {
  it("navigates the full filtered list, resets for search and category, and keeps selection inline", () => {
    render(<SelectorFixture />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous services" }).hasAttribute("disabled")).toBe(
      true
    );
    expect(screen.getByRole("button", { name: /^Service 01,/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next services" }));
    expect(screen.getByRole("button", { name: /^Service 05,/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next services" }));
    expect(screen.getByRole("button", { name: /^Service 10,/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next services" }).hasAttribute("disabled")).toBe(
      true
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous services" }));
    expect(screen.getByRole("button", { name: /^Service 05,/ })).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox", { name: "Service" }), {
      target: { value: "Service 10" },
    });
    expect(screen.getByRole("button", { name: /^Service 10,/ })).toBeTruthy();
    expect(
      screen
        .getByLabelText("Service choices")
        .querySelector("[style*='grid-template-columns']")
        ?.getAttribute("style")
    ).toContain("repeat(4, minmax(0, 1fr))");
    expect(screen.getByRole("button", { name: "Previous services" }).hasAttribute("disabled")).toBe(
      true
    );
    expect(screen.getByRole("button", { name: "Next services" }).hasAttribute("disabled")).toBe(
      true
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Service" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Category B" }));
    expect(screen.getByRole("button", { name: /^Service 02,/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Service 01,/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Service 02,/ }));
    expect(screen.getByRole("button", { name: /^Service 02,/ }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByLabelText("Selected services").textContent).toContain("Service 02");
    fireEvent.click(screen.getByRole("button", { name: "Remove Service 02" }));
    expect(screen.getByRole("button", { name: /^Service 02,/ }).getAttribute("aria-pressed")).toBe(
      "false"
    );
  });
});
