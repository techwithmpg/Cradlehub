// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AttendanceCreditDetails } from "@/components/features/attendance/shared/attendance-credit-details";
afterEach(cleanup);
describe("Attendance credited-time explanation", () => {
  it("distinguishes credited time from an absent physical clock-out", () => {
    render(
      <AttendanceCreditDetails
        timezone="Asia/Manila"
        snapshot={{
          v2: {
            version: 2,
            creditedStartAt: "2026-11-16T05:00Z",
            authorizedEndAt: "2026-11-16T12:00Z",
            creditedEndAt: "2026-11-16T12:00Z",
            actualClockOutAt: null,
            state: "preliminary",
            reason: "system_provisional_closure",
          },
        }}
      />
    );
    expect(screen.getByText("Credited from")).toBeTruthy();
    expect(screen.getByText(/1:00 PM/)).toBeTruthy();
    expect(screen.getByText(/8:00 PM/)).toBeTruthy();
    expect(screen.getByText("Actual clock-out")).toBeTruthy();
    expect(screen.getByText("Not recorded")).toBeTruthy();
    expect(screen.getByText("Preliminary")).toBeTruthy();
  });
  it("preserves legacy records without inventing V2 credit", () => {
    const view = render(<AttendanceCreditDetails timezone="Asia/Manila" snapshot={{}} />);
    expect(view.container.innerHTML).toBe("");
  });
});
