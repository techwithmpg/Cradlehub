/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaitlistFollowupTable, type WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import { updateWaitlistStatusAction } from "@/app/(dashboard)/crm/waitlist/actions";
import { toast } from "sonner";

vi.mock("@/app/(dashboard)/crm/waitlist/actions", () => ({
  updateWaitlistStatusAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  OpenAdministrativeBookingButton: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));

const sampleRow: WaitlistRow = {
  id: "e9a0c102-0c9f-442a-9828-56e297893817",
  customer_name: "Maria Santos",
  customer_phone: "09171234567",
  customer_email: "maria@example.com",
  preferred_date: "2026-10-19",
  preferred_time: "14:00",
  visit_type: "in_branch",
  notes: "Prefers female therapist",
  status: "waiting",
  created_at: "2026-10-18T00:00:00.000Z",
  services: { name: "Signature Massage" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("PERF-6 Waitlist Follow-up mutation handling", () => {
  it("successful mutation calls onChanged exactly once and shows success feedback", async () => {
    const onChanged = vi.fn();
    vi.mocked(updateWaitlistStatusAction).mockResolvedValue({ ok: true });

    render(<WaitlistFollowupTable rows={[sampleRow]} onChanged={onChanged} />);

    // Click "Follow Up" action button
    const followUpBtn = screen.getByRole("button", { name: "Follow Up" });
    fireEvent.click(followUpBtn);

    await waitFor(() => {
      expect(updateWaitlistStatusAction).toHaveBeenCalledTimes(1);
    });

    expect(updateWaitlistStatusAction).toHaveBeenCalledWith({
      requestId: sampleRow.id,
      status: "contacted",
    });

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    expect(toast.success).toHaveBeenCalledWith("Follow Up updated.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("failed mutation does not call onChanged and displays error without false success", async () => {
    const onChanged = vi.fn();
    vi.mocked(updateWaitlistStatusAction).mockResolvedValue({
      ok: false,
      error: "Waitlist request could not be updated.",
    });

    render(<WaitlistFollowupTable rows={[sampleRow]} onChanged={onChanged} />);

    const removeBtn = screen.getByRole("button", { name: "Remove" });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(updateWaitlistStatusAction).toHaveBeenCalledTimes(1);
    });

    expect(updateWaitlistStatusAction).toHaveBeenCalledWith({
      requestId: sampleRow.id,
      status: "cancelled",
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Waitlist request could not be updated.");
    });

    expect(onChanged).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
