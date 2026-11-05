// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ServiceStartActionDialog } from "@/components/features/bookings/service-start-action-dialog";

afterEach(() => cleanup());

const action = {
  bookingId: "booking-1",
  recipientName: "Mark Plaza",
  serviceName: "Head & Foot Massage",
  durationMinutes: 60,
  scheduledStart: "14:00:00",
  therapistName: "Gigi Pabon",
  roomName: "Room 2",
  groupReference: null,
};

describe("compact CRM service-start popup", () => {
  it("matches the three-action reference layout and preserves the selected service", () => {
    const start = vi.fn();
    const arrived = vi.fn();
    const notArrived = vi.fn();
    render(
      <ServiceStartActionDialog
        action={action}
        dueLabel="Service due to start in 2 minutes."
        busy={false}
        onClose={vi.fn()}
        onStart={start}
        onArrived={arrived}
        onNotArrived={notArrived}
      />
    );
    expect(screen.getByRole("heading", { name: "Action Required" })).toBeTruthy();
    expect(screen.getByText("Service due to start in 2 minutes.")).toBeTruthy();
    expect(screen.getByText("Mark Plaza")).toBeTruthy();
    expect(screen.getByText("Head & Foot Massage (60m)")).toBeTruthy();
    expect(screen.getByText("Gigi Pabon")).toBeTruthy();
    expect(screen.getByText("Room 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start Service Now" }));
    fireEvent.click(screen.getByRole("button", { name: /Customer Arrived/ }));
    fireEvent.click(screen.getByRole("button", { name: /Customer Not Arrived/ }));
    expect(start).toHaveBeenCalledOnce();
    expect(arrived).toHaveBeenCalledOnce();
    expect(notArrived).toHaveBeenCalledOnce();
  });

  it("disables all state-changing actions while a service update is running", () => {
    render(
      <ServiceStartActionDialog
        action={action}
        dueLabel="Service due to start in 1 minute."
        busy
        onClose={vi.fn()}
        onStart={vi.fn()}
        onArrived={vi.fn()}
        onNotArrived={vi.fn()}
      />
    );
    for (const name of ["Start Service Now", /Customer Arrived/, /Customer Not Arrived/]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
