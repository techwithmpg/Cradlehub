// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
}));

vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  crmCompleteServiceAction: mocks.complete,
}));
vi.mock("@/components/shared/overlays", () => ({
  AdminDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  AdminOverlayHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  AdminOverlayBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminOverlayFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { CradleFlowCompleteDialog } from "@/components/features/crm/today/cradle-flow-complete-dialog";
import { CradleFlowCheckoutDialog } from "@/components/features/crm/today/cradle-flow-checkout-dialog";

const booking = {
  id: "booking-1",
  booking_date: "2026-10-15",
  start_time: "10:00:00",
  end_time: "11:00:00",
  status: "in_progress",
  type: "walkin",
  payment_status: "pending",
  amount_paid: 0,
  price_paid: 800,
  customer_name: "Example Customer",
  service_name: "Massage",
  staff_name: "Therapist",
} as CradleFlowBooking;

beforeEach(() => mocks.complete.mockReset());
afterEach(cleanup);

describe("Cradle Flow mutation feedback", () => {
  it("shows completion progress immediately and ignores repeated clicks", async () => {
    let resolve!: (value: { success: boolean }) => void;
    mocks.complete.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const onCompleted = vi.fn();
    render(
      <CradleFlowCompleteDialog
        booking={booking}
        open
        onOpenChange={vi.fn()}
        onCompleted={onCompleted}
      />
    );
    const button = screen.getByRole("button", { name: "Mark Service Complete" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Completing…" }).hasAttribute("disabled")).toBe(true);
    expect(onCompleted).not.toHaveBeenCalled();

    resolve({ success: true });
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
  });

  it("shows payment processing and confirms paid state only after the action returns", async () => {
    let resolve!: (value: { success: boolean }) => void;
    const paymentAction = vi.fn().mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const onPaid = vi.fn();
    render(
      <CradleFlowCheckoutDialog
        booking={booking}
        open
        onOpenChange={vi.fn()}
        paymentAction={paymentAction}
        onPaid={onPaid}
      />
    );
    const button = screen.getByRole("button", { name: "Complete Payment" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(paymentAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Processing…" }).hasAttribute("disabled")).toBe(true);
    expect(onPaid).not.toHaveBeenCalled();

    resolve({ success: true });
    await waitFor(() => expect(onPaid).toHaveBeenCalledOnce());
  });
});
