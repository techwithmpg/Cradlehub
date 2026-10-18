/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingsWorkspace } from "@/components/features/bookings/bookings-workspace";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/features/bookings/bookings-table", () => ({
  BookingsTable: () => null,
}));
vi.mock("@/components/features/bookings/bookings-desktop-workspace", () => ({
  BookingsDesktopWorkspace: () => null,
}));

afterEach(cleanup);

describe("PERF-9B Owner Bookings search input lifecycle", () => {
  it("updates Owner URL-restored search text without remounting the whole workspace", () => {
    const props = {
      workspaceContext: "owner" as const,
      viewerRole: "owner",
      date: "2026-10-18",
      bookings: [],
      search: "alice",
    };
    const view = render(<BookingsWorkspace {...props} />);
    const field = screen.getByPlaceholderText("Customer, phone, staff, or booking ID") as HTMLInputElement;
    expect(field.value).toBe("alice");

    // Entered but unsubmitted text should not prevent a subsequent URL
    // navigation from restoring its authoritative search query.
    fireEvent.change(field, { target: { value: "unsent draft" } });
    expect(field.value).toBe("unsent draft");

    const heading = screen.getByRole("heading", { name: "Bookings" });
    view.rerender(<BookingsWorkspace {...props} search="bob" />);

    const restoredField = screen.getByPlaceholderText("Customer, phone, staff, or booking ID") as HTMLInputElement;
    expect(restoredField.value).toBe("bob");
    expect(restoredField).not.toBe(field);
    expect(screen.getByRole("heading", { name: "Bookings" })).toBe(heading);
  });
});
