/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicScanResultView } from "@/components/features/attendance/public-scan-result";
import type { PublicScanResult } from "@/lib/attendance/types";

vi.mock("@/components/shared/brand-logo", () => ({
  BrandLogo: () => <div data-testid="brand-logo" />,
}));

const baseResult: PublicScanResult = {
  ok: false,
  outcome: "blocked",
  reasonCode: "wrong_branch",
  severity: "critical",
  title: "Wrong branch detected",
  message:
    "This QR belongs to a different branch than your staff profile. If your profile branch is wrong, request a correction.",
  securityNote: "Your request must be approved by the front desk before scanning again.",
  scanEventId: "scan-1",
  branchCorrection: {
    staffId: "staff-1",
    staffName: "Maria Santos",
    currentBranchId: "branch-sm",
    currentBranchName: "Cradle Wellness Living SM",
    requestedBranchId: "branch-main",
    requestedBranchName: "Cradle Wellness Main Spa",
    qrPointId: "qr-1",
    publicCode: "MAIN-QR",
    scanEventId: "scan-1",
    deviceId: "device-1",
    canRequestBranchCorrection: true,
    existingPendingRequest: null,
  },
};

afterEach(() => cleanup());

describe("PublicScanResultView branch correction", () => {
  it("shows the wrong-branch correction option with both branch names", () => {
    const onRequest = vi.fn();

    render(
      <PublicScanResultView
        result={baseResult}
        onRequestBranchCorrection={onRequest}
      />
    );

    expect(screen.getByRole("heading", { name: "Wrong branch detected" })).toBeTruthy();
    expect(screen.getByText("Your profile is currently assigned to")).toBeTruthy();
    expect(screen.getByText("Cradle Wellness Living SM")).toBeTruthy();
    expect(screen.getByText("This QR is for")).toBeTruthy();
    expect(screen.getByText("Cradle Wellness Main Spa")).toBeTruthy();
    expect(screen.getByText("If this is wrong, request branch correction.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Request branch correction/i }));
    expect(onRequest).toHaveBeenCalledWith(baseResult.branchCorrection);
  });

  it("shows a pending request state and disables duplicate creation", () => {
    const onRequest = vi.fn();

    render(
      <PublicScanResultView
        result={{
          ...baseResult,
          branchCorrection: {
            ...baseResult.branchCorrection!,
            canRequestBranchCorrection: false,
            existingPendingRequest: {
              id: "request-1",
              createdAt: "2026-07-09T08:00:00.000Z",
              requestedBranchName: "Cradle Wellness Main Spa",
            },
          },
        }}
        onRequestBranchCorrection={onRequest}
      />
    );

    expect(screen.getByText("Branch correction request already pending.")).toBeTruthy();
    expect(screen.getByText(/Requested branch: Cradle Wellness Main Spa/)).toBeTruthy();

    const button = screen.getByRole("button", { name: /Request branch correction/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onRequest).not.toHaveBeenCalled();
  });
});
