/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrmStaffBranchCorrectionsTab } from "@/components/features/crm/staff/crm-staff-branch-corrections-tab";
import { reviewBranchCorrectionRequestAction } from "@/app/(dashboard)/crm/staff/actions";
import type { BranchCorrectionInboxItem } from "@/lib/staff/branch-correction-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/app/(dashboard)/crm/staff/actions", () => ({
  reviewBranchCorrectionRequestAction: vi.fn(),
}));

const request: BranchCorrectionInboxItem = {
  id: "request-1",
  staffId: "staff-1",
  staffName: "Maria Santos",
  staffNickname: "Mia",
  staffPhone: "+63 999 123 4567",
  staffType: "therapist",
  staffSystemRole: "staff",
  staffIsActive: true,
  currentBranchId: "branch-sm",
  currentBranchName: "Cradle Wellness Living SM",
  requestedBranchId: "branch-main",
  requestedBranchName: "Cradle Wellness Main Spa",
  qrPointLabel: "Main Spa Attendance QR",
  qrPublicCode: "MAIN-QR",
  scanEventId: "scan-1",
  requestSource: "qr_wrong_branch",
  reason: null,
  status: "pending",
  createdAt: "2026-07-09T08:00:00.000Z",
  reviewedAt: null,
  reviewerNote: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CrmStaffBranchCorrectionsTab", () => {
  it("shows pending correction details and approves through the review action", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(reviewBranchCorrectionRequestAction).mockResolvedValue({
      ok: true,
      requestId: request.id,
      status: "approved",
      message: "Branch correction approved.",
    });

    render(<CrmStaffBranchCorrectionsTab requests={[request]} />);

    expect(screen.getByText("Maria Santos")).toBeTruthy();
    expect(screen.getByText("Cradle Wellness Living SM")).toBeTruthy();
    expect(screen.getByText("Cradle Wellness Main Spa")).toBeTruthy();

    fireEvent.click(screen.getByText("View scan details"));
    expect(screen.getByText("Main Spa Attendance QR")).toBeTruthy();
    expect(screen.getByText("MAIN-QR")).toBeTruthy();
    expect(screen.getByText("scan-1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));

    await waitFor(() => {
      expect(reviewBranchCorrectionRequestAction).toHaveBeenCalledWith({
        requestId: request.id,
        status: "approved",
        reviewerNote: undefined,
      });
    });
  });

  it("renders an empty branch correction inbox", () => {
    render(<CrmStaffBranchCorrectionsTab requests={[]} />);

    expect(screen.getByText("No pending branch correction requests.")).toBeTruthy();
  });
});
