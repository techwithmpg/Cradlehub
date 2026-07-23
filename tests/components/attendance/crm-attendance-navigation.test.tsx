/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmAttendanceNavigation } from "@/components/features/attendance/crm-attendance-navigation";

afterEach(cleanup);

describe("CrmAttendanceNavigation", () => {
  it("renders exactly four primary workspaces and the canonical review count", () => {
    render(
      <CrmAttendanceNavigation activeView="today" reviewCount={3} onChange={() => undefined} />
    );
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Today" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Review, 3 open" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "History" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Setup" })).toBeTruthy();
  });

  it("supports keyboard navigation", () => {
    const onChange = vi.fn();
    render(<CrmAttendanceNavigation activeView="review" reviewCount={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("history");
  });
});
