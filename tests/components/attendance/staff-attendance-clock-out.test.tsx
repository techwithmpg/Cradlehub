/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const action = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({ clockOutFromStaffPortalAction: action }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { StaffAttendanceClockOut } from "@/components/features/staff-portal/staff-attendance-clock-out";

const eligible = {
  enabled: true,
  code: "final_home_service_complete",
  label: "Clock out",
  message: "Your final home-service assignment is complete.",
  expectedClockOutAt: null,
  nextAssignmentAt: null,
};

beforeEach(() => { action.mockReset(); refresh.mockReset(); });
afterEach(cleanup);

describe("mobile portal clock-out", () => {
  it("allows one action, displays the recorded time and blocks repeat submission", async () => {
    action.mockResolvedValue({ ok: true, title: "All done", message: "Your shift ended.", checkedOutAt: "2026-10-31T12:00:00Z" });
    render(<StaffAttendanceClockOut availability={eligible} timezone="Asia/Manila" />);
    fireEvent.click(screen.getByRole("button", { name: /clock out/i }));
    await waitFor(() => expect(screen.getByText(/Clocked out at 8:00/)).toBeTruthy());
    expect(action).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /clock out/i })).toBeNull();
  });

  it("never offers remote completion for QR-only or unfinished shifts", () => {
    const { rerender } = render(<StaffAttendanceClockOut availability={{ ...eligible, enabled: false, code: "use_branch_qr", label: "Use branch QR", message: "Use the branch QR." }} timezone="Asia/Manila" />);
    expect(screen.queryByRole("button", { name: /clock out/i })).toBeNull();
    expect(screen.getByText("Branch QR")).toBeTruthy();
    rerender(<StaffAttendanceClockOut availability={{ ...eligible, enabled: false, code: "active_assignment", label: "Complete assignment first", message: "Complete the active service." }} timezone="Asia/Manila" />);
    expect(screen.queryByRole("button", { name: /clock out/i })).toBeNull();
    expect(screen.getByText("Complete the active service.")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps the action available after a server refusal", async () => {
    action.mockResolvedValue({ ok: false, title: "Another assignment is scheduled", message: "Finish your final service." });
    render(<StaffAttendanceClockOut availability={eligible} timezone="Asia/Manila" />);
    fireEvent.click(screen.getByRole("button", { name: /clock out/i }));
    await waitFor(() => expect(screen.getByText("Finish your final service.")).toBeTruthy());
    expect(screen.getByRole("button", { name: /clock out/i })).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
