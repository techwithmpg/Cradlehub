/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FrontDeskDutyBanner } from "@/components/features/crm/today/front-desk-duty-banner";

afterEach(() => cleanup());

const duty = {
  name: "Maria",
  shiftLabel: "Closing CSR duty",
  activeOperator: false,
  confirmedHandover: false,
  handover: { sessionId: "session-1", outgoingName: "Anna", shiftLabel: "Closing CSR duty" },
};

describe("Front Desk duty reminder", () => {
  it("shows a non-blocking review link and lets staff dismiss it for the current view", () => {
    render(<FrontDeskDutyBanner duty={duty} handoverConfirmed={false} branchName="Main Branch" />);
    expect(screen.getByText("Welcome, Maria")).toBeTruthy();
    expect(screen.getByText(/Closing CSR duty · Main Branch/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review Handover" }).getAttribute("href")).toBe(
      "/crm/cash-flow?handover=session-1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("link", { name: "Review Handover" })).toBeNull();
    expect(screen.queryByText(/active Front Desk operator/)).toBeNull();
  });

  it("shows success only with confirmed authoritative operator context", () => {
    const { rerender } = render(
      <FrontDeskDutyBanner
        duty={{ ...duty, handover: null }}
        handoverConfirmed={true}
        branchName="Main Branch"
      />
    );
    expect(screen.queryByText(/active Front Desk operator/)).toBeNull();
    rerender(
      <FrontDeskDutyBanner
        duty={{ ...duty, handover: null, activeOperator: true }}
        handoverConfirmed={true}
        branchName="Main Branch"
      />
    );
    expect(screen.getByText(/active Front Desk operator/)).toBeTruthy();
  });
});
