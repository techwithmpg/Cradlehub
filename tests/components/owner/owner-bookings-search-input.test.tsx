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

  it("preserves Owner branch/date/type/status when search submits with filters collapsed", () => {
    const props = {
      workspaceContext: "owner" as const,
      viewerRole: "owner",
      date: "2026-10-17",
      branchFilter: "main",
      typeFilter: "online",
      statusFilter: "confirmed",
      search: "Alice",
      branches: [{ id: "main", name: "Main Spa" }, { id: "sm", name: "SM" }],
      bookings: [],
    };
    const view = render(<BookingsWorkspace {...props} />);
    const getForm = () => {
      const form = view.container.querySelector<HTMLFormElement>('form[method="get"]');
      expect(form).not.toBeNull();
      return new FormData(form!);
    };

    // With the filter drawer open, active fields are still serialized.
    expect(getForm().getAll("date")).toEqual(["2026-10-17"]);
    expect(getForm().getAll("branch")).toEqual(["main"]);
    expect(getForm().getAll("type")).toEqual(["online"]);
    expect(getForm().getAll("status")).toEqual(["confirmed"]);

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const collapsed = getForm();
    expect(collapsed.getAll("date")).toEqual(["2026-10-17"]);
    expect(collapsed.getAll("branch")).toEqual(["main"]);
    expect(collapsed.getAll("type")).toEqual(["online"]);
    expect(collapsed.getAll("status")).toEqual(["confirmed"]);
    expect(collapsed.get("search")).toBe("Alice");

    // A selected-branch URL update must change the hidden scope, not
    // preserve the previous branch or broaden the query.
    view.rerender(<BookingsWorkspace {...props} branchFilter="sm" date="2026-10-18" />);
    const updated = getForm();
    expect(updated.getAll("branch")).toEqual(["sm"]);
    expect(updated.getAll("date")).toEqual(["2026-10-18"]);
  });
});
