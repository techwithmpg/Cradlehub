/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  handover: vi.fn(),
}));

vi.mock("@/lib/cash-flow/cash-flow-actions", () => ({
  openCashSessionAction: mocks.open,
  closeCashSessionAction: mocks.close,
  handoverCashSessionAction: mocks.handover,
}));

import { OpenCashDrawerModal } from "@/components/features/cash-flow/open-cash-drawer-modal";
import { CloseDrawerModal } from "@/components/features/cash-flow/close-drawer-modal";
import { HandoverDrawerModal } from "@/components/features/cash-flow/handover-drawer-modal";

const drawer = {
  id: "drawer-1",
  name: "Front Desk Drawer",
  accountType: "cash_drawer" as const,
  identifierMask: "Drawer 1",
  branchId: "branch-a",
};

const session = {
  id: "session-1",
  branchId: "branch-a",
  businessDate: "2026-10-18",
  cashDrawerAccountId: "drawer-1",
  cashDrawerName: "Front Desk Drawer",
  status: "open" as const,
  openingFloat: 100,
  openedBy: "staff-1",
  openedByName: "CSR One",
  openedAt: "2026-10-18T08:00:00.000Z",
  currentCustodianId: "staff-1",
  currentCustodianName: "CSR One",
  expectedCash: 150,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("PERF-8 failed Cash Flow mutations", () => {
  it("does not signal reconciliation when opening a drawer fails", async () => {
    const onSuccess = vi.fn();
    mocks.open.mockResolvedValue({
      ok: false,
      error: "Open failed",
    });

    render(
      <OpenCashDrawerModal
        open
        onOpenChange={vi.fn()}
        branchId="branch-a"
        businessDate="2026-10-18"
        availableDrawers={[drawer]}
        activeSessions={[]}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(
      screen.getByLabelText("Opening cash"),
      { target: { value: "100" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open drawer" })
    );

    await waitFor(() =>
      expect(screen.getByText("Open failed")).toBeTruthy()
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not signal reconciliation when drawer close fails", async () => {
    const onSuccess = vi.fn();
    mocks.close.mockResolvedValue({
      ok: false,
      error: "Close failed",
    });

    render(
      <CloseDrawerModal
        open
        onOpenChange={vi.fn()}
        session={session}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(
      screen.getByLabelText(/Physical counted cash/i),
      { target: { value: "150" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Close Session" })
    );

    await waitFor(() =>
      expect(screen.getByText("Close failed")).toBeTruthy()
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not signal reconciliation when handover fails", async () => {
    const onSuccess = vi.fn();
    mocks.handover.mockResolvedValue({
      ok: false,
      error: "Handover failed",
    });

    render(
      <HandoverDrawerModal
        open
        onOpenChange={vi.fn()}
        session={session}
        staffOptions={[
          { id: "staff-1", name: "CSR One", role: "crm" },
          { id: "staff-2", name: "CSR Two", role: "crm" },
        ]}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(
      screen.getByLabelText(/Physical count/i),
      { target: { value: "150" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm Handover/i })
    );

    await waitFor(() =>
      expect(screen.getByText("Handover failed")).toBeTruthy()
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
