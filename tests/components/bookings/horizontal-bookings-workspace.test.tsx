// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  openBookingModal: vi.fn(),
  rescheduleBookingAction: vi.fn(),
  assignBookingTherapistAction: vi.fn(),
  assignBookingRoomAction: vi.fn(),
  getRoomAssignmentOptionsAction: vi.fn(),
  getTherapistRecommendationsAction: vi.fn(),
  crmStartServiceAction: vi.fn(),
  crmCompleteServiceAction: vi.fn(),
  recordBookingFollowupAction: vi.fn(),
  createInhouseBookingMultiAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  routerRefresh: vi.fn(),
  routerPush: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.routerRefresh,
    push: mocks.routerPush,
  }),
  usePathname: () => "/crm/bookings",
  useSearchParams: () => new URLSearchParams("date=2026-10-29"),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  useAdministrativeBookingModal: () => ({
    openBookingModal: mocks.openBookingModal,
    closeBookingModal: vi.fn(),
    branchId: "branch-1",
    branchName: "BGC Branch",
    services: [
      {
        id: "svc-1",
        name: "Signature Deep Tissue",
        durationMinutes: 60,
        price: 1200,
        availableInSpa: true,
        availableHomeService: true,
      },
      {
        id: "svc-2",
        name: "Hot Stone Therapy",
        durationMinutes: 90,
        price: 1800,
        availableInSpa: true,
        availableHomeService: true,
      },
    ],
    staff: [
      { id: "staff-1", name: "Therapist Ana", nickname: "Ana" },
      { id: "staff-2", name: "Therapist Bea", nickname: "Bea" },
    ],
    resources: [
      { id: "room-1", name: "Suite 1", type: "room" },
      { id: "room-2", name: "Suite 2", type: "room" },
    ],
    optionsReady: true,
    optionsError: null,
  }),
  OpenAdministrativeBookingButton: ({ label = "New Booking" }: { label?: string }) => (
    <button type="button">{label}</button>
  ),
}));

vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  rescheduleBookingAction: mocks.rescheduleBookingAction,
  assignBookingTherapistAction: mocks.assignBookingTherapistAction,
  assignBookingRoomAction: mocks.assignBookingRoomAction,
  getRoomAssignmentOptionsAction: mocks.getRoomAssignmentOptionsAction,
  crmStartServiceAction: mocks.crmStartServiceAction,
  crmCompleteServiceAction: mocks.crmCompleteServiceAction,
  recordBookingFollowupAction: mocks.recordBookingFollowupAction,
}));

vi.mock("@/lib/actions/assignment-recommendations", () => ({
  getTherapistRecommendationsAction: mocks.getTherapistRecommendationsAction,
}));

vi.mock("@/lib/actions/inhouse-booking", () => ({
  createInhouseBookingMultiAction: mocks.createInhouseBookingMultiAction,
}));

vi.mock("@/lib/actions/administrative-booking", () => ({
  getAdministrativeBookingCustomerPrefillAction: vi.fn(),
}));

vi.mock("@/lib/actions/attendance-queue", () => ({
  getAttendanceQueueSuggestionAction: async () => ({ success: true, suggestion: null }),
}));

import { BookingsDesktopWorkspace } from "@/components/features/bookings/bookings-desktop-workspace";
import { QuickBookingForm } from "@/components/features/bookings/quick-booking-form";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

function makeBooking(overrides: Partial<WorkspaceBookingRow> = {}): WorkspaceBookingRow {
  return {
    id: "booking-101",
    order_id: "ORD-2026-101",
    branch_id: "branch-1",
    customer_id: "cust-1",
    service_id: "svc-1",
    staff_id: "staff-1",
    resource_id: "room-1",
    booking_date: "2026-10-29",
    start_time: "14:00:00",
    end_time: "15:00:00",
    status: "confirmed",
    booking_progress_status: "confirmed",
    type: "walkin",
    delivery_type: "in_spa",
    price: 1200,
    pricing_status: "locked",
    payment_status: "paid",
    payment_method: "gcash",
    payment_intent_status: "succeeded",
    metadata: {
      customer_notes: "Prefers warm oil and quiet room",
      duration_minutes: 60,
    },
    customers: {
      id: "cust-1",
      full_name: "Elena Navarro",
      phone: "09171112233",
      email: "elena@example.com",
    },
    services: {
      id: "svc-1",
      name: "Signature Deep Tissue",
      duration_minutes: 60,
      price: 1200,
      category: "Massage",
    },
    staff: {
      id: "staff-1",
      full_name: "Therapist Ana",
      nickname: "Ana",
      role: "therapist",
    },
    branch_resources: {
      id: "room-1",
      name: "Suite 1",
      type: "room",
    },
    ...overrides,
  } as WorkspaceBookingRow;
}

describe("Horizontal Bookings Workspace & Quick Edit Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTherapistRecommendationsAction.mockResolvedValue({
      success: true,
      data: {
        therapists: [
          {
            staffId: "staff-1",
            displayName: "Therapist Ana",
            status: "recommended",
          },
          {
            staffId: "staff-2",
            displayName: "Therapist Bea",
            status: "unavailable",
          },
        ],
      },
    });
    mocks.getRoomAssignmentOptionsAction.mockResolvedValue({
      success: true,
      notApplicable: false,
      resources: [
        { id: "room-1", name: "Suite 1", isAvailable: true, isCurrent: true, isRecommended: false },
        { id: "room-2", name: "Suite 2", isAvailable: false, isCurrent: false, isRecommended: false },
      ],
    });
    mocks.rescheduleBookingAction.mockResolvedValue({ success: true });
    mocks.assignBookingTherapistAction.mockResolvedValue({ success: true });
    mocks.assignBookingRoomAction.mockResolvedValue({ success: true });
    mocks.recordBookingFollowupAction.mockResolvedValue({ success: true });
    mocks.createInhouseBookingMultiAction.mockResolvedValue({
      ok: true,
      bookingId: "new-booking-should-not-happen",
    });
    mocks.fetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        available: true,
        providers: [],
        availableStaffIds: ["staff-1", "staff-2"],
      }),
    }));
    vi.stubGlobal("fetch", mocks.fetch);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T04:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders horizontal booking rows with payment status, therapist, room, and expands only one Quick Edit at a time", async () => {
    const booking1 = makeBooking();
    const booking2 = makeBooking({
      id: "booking-102",
      order_id: "ORD-2026-102",
      start_time: "16:00:00",
      end_time: "17:30:00",
      payment_status: "partial",
      metadata: {
        customer_notes: "Second booking note",
        duration_minutes: 90,
      },
      customers: {
        id: "cust-2",
        full_name: "Marco Reyes",
        phone: "09189998877",
        email: "marco@example.com",
      },
      services: {
        id: "svc-2",
        name: "Hot Stone Therapy",
        duration_minutes: 90,
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking1, booking2]}
      />
    );

    expect(screen.getByText("Elena Navarro")).toBeTruthy();
    expect(screen.getByText("Marco Reyes")).toBeTruthy();
    expect(screen.getByText("Paid")).toBeTruthy();
    expect(screen.getByText("Partial")).toBeTruthy();

    const expandButtons = screen.getAllByRole("button", { name: /Expand quick edit/i });
    expect(expandButtons).toHaveLength(2);

    // Expand first booking Quick Edit and verify preloaded booking fields
    fireEvent.click(expandButtons[0]!);
    expect(await screen.findByDisplayValue("Prefers warm oil and quiet room")).toBeTruthy();
    expect((screen.getByLabelText("Booking date") as HTMLInputElement).value).toBe("2026-10-29");
    expect((screen.getByLabelText("Booking time") as HTMLInputElement).value).toBe("14:00");

    // Expanding second booking collapses the first booking's Quick Edit
    const nextExpandButton = screen.getByRole("button", { name: /Expand quick edit/i });
    fireEvent.click(nextExpandButton);
    expect(await screen.findByDisplayValue("Second booking note")).toBeTruthy();
    expect(screen.queryByDisplayValue("Prefers warm oil and quiet room")).toBeNull();

    // Cancel Edit collapses Quick Edit without mutating
    fireEvent.click(screen.getByRole("button", { name: /Cancel Edit/i }));
    expect(screen.queryByDisplayValue("Second booking note")).toBeNull();
    expect(mocks.rescheduleBookingAction).not.toHaveBeenCalled();
  });

  it("enforces therapist/room conflict prevention and service-change financial protections in Quick Edit", async () => {
    const booking = makeBooking();

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Expand quick edit/i }));

    await waitFor(() => {
      expect(mocks.getTherapistRecommendationsAction).toHaveBeenCalled();
      expect(mocks.getRoomAssignmentOptionsAction).toHaveBeenCalled();
    });

    // Occupied room (room-2) and unavailable therapist (staff-2) are disabled
    const occupiedRoomOption = (await screen.findByRole("option", {
      name: /Suite 2 \(Occupied\)/i,
    })) as HTMLOptionElement;
    expect(occupiedRoomOption.disabled).toBe(true);

    const unavailableTherapistOption = (await screen.findByRole("option", {
      name: /Therapist Bea \(Unavailable\)/i,
    })) as HTMLOptionElement;
    expect(unavailableTherapistOption.disabled).toBe(true);

    // Selecting a different service triggers Commercial Protection warning and disables Save Changes
    const serviceSelect = screen.getByRole("combobox", { name: /Service/i });
    fireEvent.change(serviceSelect, { target: { value: "svc-2" } });

    expect(await screen.findByText(/Commercial Protection:/i)).toBeTruthy();
    const saveButton = screen.getByRole("button", { name: /Save Changes/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it("opens Reschedule modal with preloaded booking values and preserves original booking/order identity", async () => {
    const homeBooking = makeBooking({
      id: "booking-home-1",
      order_id: "ORD-HOME-1",
      type: "home_service",
      delivery_type: "home_service",
      resource_id: null,
      branch_resources: null,
      metadata: {
        customer_notes: "Gate code 1234",
        home_service_address: {
          full_address: "88 McKinley Pkwy, Taguig",
          access_note: "Lobby concierge",
        },
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[homeBooking]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Expand quick edit/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Reschedule/i }));

    expect(mocks.openBookingModal).toHaveBeenCalledWith({
      mode: "home_service",
      rescheduleBookingId: "booking-home-1",
      rescheduleOrderId: "ORD-HOME-1",
      customerId: "cust-1",
      name: "Elena Navarro",
      phone: "09171112233",
      serviceId: "svc-1",
      staffId: "staff-1",
      resourceId: undefined,
      date: "2026-10-29",
      time: "14:00",
      notes: "Gate code 1234",
      homeServiceAddress: "88 McKinley Pkwy, Taguig",
      homeServiceAccessNote: "Lobby concierge",
    });
  });

  it("handles multi-field partial-save failure in Quick Edit without reporting full success and retries only failed steps", async () => {
    mocks.getRoomAssignmentOptionsAction.mockResolvedValue({
      success: true,
      notApplicable: false,
      resources: [
        { id: "room-1", name: "Suite 1", isAvailable: true, isCurrent: true, isRecommended: false },
        { id: "room-2", name: "Suite 2", isAvailable: true, isCurrent: false, isRecommended: true },
      ],
    });

    // First attempt: schedule succeeds, room assignment fails
    mocks.rescheduleBookingAction.mockResolvedValueOnce({ success: true });
    mocks.assignBookingRoomAction.mockResolvedValueOnce({
      success: false,
      error: "Room Suite 2 was just taken by another session.",
    });

    const onBookingsChanged = vi.fn();
    const booking = makeBooking();

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
        onBookingsChanged={onBookingsChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Expand quick edit/i }));

    const timeInput = await screen.findByLabelText("Booking time");
    fireEvent.change(timeInput, { target: { value: "15:30" } });

    const roomSelect = screen.getByRole("combobox", { name: /Room/i });
    fireEvent.change(roomSelect, { target: { value: "room-2" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mocks.rescheduleBookingAction).toHaveBeenCalledTimes(1);
      expect(mocks.assignBookingRoomAction).toHaveBeenCalledTimes(1);
    });

    // Must NOT report full success or close Quick Edit
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.createInhouseBookingMultiAction).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Partial update: Schedule saved, but room assignment failed/i)
    ).toBeTruthy();
    expect(onBookingsChanged).toHaveBeenCalledTimes(1);

    // Retry Save Changes: schedule was already saved, so only room assignment should run
    mocks.assignBookingRoomAction.mockResolvedValueOnce({ success: true });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mocks.assignBookingRoomAction).toHaveBeenCalledTimes(2);
    });
    expect(mocks.rescheduleBookingAction).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Booking updated",
      expect.objectContaining({ description: "Changes have been saved successfully." })
    );
  });

  it("handles multi-field partial-save failure in QuickBookingForm reschedule mode without closing modal or creating a duplicate booking", async () => {
    mocks.rescheduleBookingAction.mockResolvedValueOnce({ success: true });
    mocks.assignBookingRoomAction.mockResolvedValueOnce({
      success: false,
      error: "Selected room is unavailable for that slot.",
    });

    const onSuccess = vi.fn();
    const onCancel = vi.fn();

    render(
      <QuickBookingForm
        branchId="branch-1"
        branchName="BGC Branch"
        bookingRules={{
          inSpaStartTime: "00:00",
          inSpaEndTime: "23:59",
          homeServiceEnabled: true,
          homeServiceStartTime: "00:00",
          homeServiceEndTime: "23:59",
          maxAdvanceBookingDays: 30,
        }}
        initialMode="phone"
        initialName="Elena Navarro"
        initialPhone="09171112233"
        initialServiceId="svc-1"
        initialStaffId="staff-1"
        initialResourceId="room-1"
        initialDate="2026-10-29"
        initialTime="14:00"
        initialNotes="Prefers warm oil"
        rescheduleBookingId="booking-101"
        rescheduleOrderId="ORD-2026-101"
        services={[
          {
            id: "svc-1",
            name: "Signature Deep Tissue",
            price: 1200,
            durationMinutes: 60,
            availableInSpa: true,
            availableHomeService: true,
          },
        ]}
        staff={[
          { id: "staff-1", name: "Therapist Ana", nickname: "Ana", serviceIds: ["svc-1"] },
          { id: "staff-2", name: "Therapist Bea", nickname: "Bea", serviceIds: ["svc-1"] },
        ]}
        resources={[
          { id: "room-1", name: "Suite 1", type: "room" },
          { id: "room-2", name: "Suite 2", type: "room" },
        ]}
        successBehavior="stay"
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    // Verify original order identity and payment status preservation in summary
    expect(screen.getByText("ORD-2026-101")).toBeTruthy();
    expect(screen.getByText("Preserved from original order")).toBeTruthy();

    // Change date and change room
    const dateInput = screen.getByLabelText("Guest 1 shared date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-10-30" } });

    const roomOption = screen.getByRole("option", { name: "Suite 2" });
    const roomSelect = roomOption.parentElement as HTMLSelectElement;
    fireEvent.change(roomSelect, { target: { value: "room-2" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mocks.rescheduleBookingAction).toHaveBeenCalledTimes(1);
      expect(mocks.assignBookingRoomAction).toHaveBeenCalledTimes(1);
    });

    // Must not report full success, close modal, or create a new booking
    expect(mocks.createInhouseBookingMultiAction).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Partial update \(schedule saved\): Selected room is unavailable/i)
    ).toBeTruthy();

    // Retry Save Changes -> only retries room assignment, then succeeds
    mocks.assignBookingRoomAction.mockResolvedValueOnce({ success: true });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mocks.assignBookingRoomAction).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "booking-101",
          date: "2026-10-30",
        })
      );
    });
    expect(mocks.rescheduleBookingAction).toHaveBeenCalledTimes(1);
    expect(mocks.createInhouseBookingMultiAction).not.toHaveBeenCalled();
  });

  it("links customer name to Customer Profile (/crm/[customerId])", async () => {
    const booking = makeBooking({
      customers: {
        id: "cust-99",
        full_name: "Teresa Mendoza",
        phone: "09170001111",
        email: "teresa@example.com",
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    const customerLink = screen.getByRole("link", { name: "Teresa Mendoza" });
    expect(customerLink).toBeTruthy();
    expect(customerLink.getAttribute("href")).toBe("/crm/cust-99");
  });

  it("presents Cancel Booking | Cancel Edit | Reschedule | Save Changes in Quick Edit and cancels booking", async () => {
    const booking = makeBooking({
      id: "booking-to-cancel",
      customers: {
        id: "cust-cancel",
        full_name: "Eduardo Cruz",
        phone: "09172223333",
        email: "eduardo@example.com",
      },
    });

    const onBookingsChanged = vi.fn();

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
        onBookingsChanged={onBookingsChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Expand quick edit/i }));

    // Verify all four buttons in approved order
    expect(screen.getByRole("button", { name: "Cancel Booking" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeTruthy();

    // Click Cancel Booking -> opens CancelBookingDialog
    fireEvent.click(screen.getByRole("button", { name: "Cancel Booking" }));
    expect(await screen.findByRole("heading", { name: "Cancel booking?" })).toBeTruthy();

    // Select cancellation reason and confirm
    const reasonSelect = screen.getByRole("combobox", { name: /Reason/i });
    fireEvent.change(reasonSelect, { target: { value: "customer_requested" } });

    const confirmCancelBtn = screen.getByRole("button", { name: "Cancel Booking" });
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(mocks.recordBookingFollowupAction).toHaveBeenCalledWith({
        bookingId: "booking-to-cancel",
        result: "cancel",
        cancellationReason: "customer_requested",
        note: undefined,
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Booking cancelled.");
      expect(onBookingsChanged).toHaveBeenCalled();
    });
  });

  it("displays Payment Due and Completed pill for completed service with unpaid balance, not Waiting", () => {
    const booking = makeBooking({
      id: "booking-unpaid-done",
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      session_completed_at: "2026-10-29T11:05:00Z",
      payment_status: "unpaid",
      metadata: { price: 1200 },
      customers: {
        id: "cust-unpaid",
        full_name: "Unpaid Completed Customer",
        phone: "09179998888",
        email: "unpaid@example.com",
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    // Assert "Payment Due" appears in time substatus
    expect(screen.getByText("Payment Due")).toBeTruthy();

    // Assert "Completed" appears in status pill and button
    const completedElements = screen.getAllByText("Completed");
    expect(completedElements.length).toBeGreaterThanOrEqual(1);

    // Assert "Waiting" does NOT appear
    expect(screen.queryByText("Waiting")).toBeNull();
  });

  it("does not display Waiting or Start Service for completed service with historical check-in timestamp", () => {
    const booking = makeBooking({
      id: "booking-hist-checkin",
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T09:00:00Z",
      arrived_at: "2026-10-29T09:00:00Z",
      session_started_at: "2026-10-29T09:05:00Z",
      session_completed_at: "2026-10-29T10:05:00Z",
      payment_status: "paid",
      customers: {
        id: "cust-hist",
        full_name: "Historical Checkin Customer",
        phone: "09171234567",
        email: "hist@example.com",
      },
    });

    // In a non-filtered or workspace context="owner" where completed+paid is rendered
    render(
      <BookingsDesktopWorkspace
        workspaceContext="owner"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    // Assert row shows Completed
    const completedElements = screen.getAllByText("Completed");
    expect(completedElements.length).toBeGreaterThanOrEqual(1);

    // Assert "Waiting" and "Start Service" do NOT appear
    expect(screen.queryByText("Waiting")).toBeNull();
    expect(screen.queryByText("Start Service")).toBeNull();
  });

  it("handles multi-guest order where guest 1 is completed and guest 2 is waiting by keeping group actionable and targeting unfinished line", async () => {
    const line1 = makeBooking({
      id: "booking-multi-1",
      order_id: "ORD-MULTI-99",
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      session_completed_at: "2026-10-29T11:00:00Z",
      payment_status: "unpaid",
      customers: {
        id: "cust-1",
        full_name: "Elena Navarro",
        phone: "09171112233",
        email: "elena@example.com",
      },
    });

    const line2 = makeBooking({
      id: "booking-multi-2",
      order_id: "ORD-MULTI-99",
      status: "confirmed",
      booking_progress_status: "checked_in",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: null,
      session_completed_at: null,
      payment_status: "unpaid",
      customers: {
        id: "cust-2",
        full_name: "Marco Navarro",
        phone: "09174445566",
        email: "marco@example.com",
      },
    });

    mocks.crmStartServiceAction.mockResolvedValueOnce({ success: true });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[line1, line2]}
      />
    );

    // Group should NOT be marked completed because line 2 is still waiting
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByText("Start Service")).toBeTruthy();

    // Clicking Start Service should target line2 (the unfinished waiting line), NOT line1
    fireEvent.click(screen.getByRole("button", { name: "Start Service" }));

    await waitFor(() => {
      expect(mocks.crmStartServiceAction).toHaveBeenCalledWith({
        bookingId: "booking-multi-2",
      });
    });
  });

  it("unpaid completed service with missing price metadata renders Unpaid badge and Payment Due time substatus, NOT Paid", () => {
    const booking = makeBooking({
      id: "booking-unpaid-missing-price",
      order_id: null,
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      session_completed_at: "2026-10-29T11:05:00Z",
      payment_status: "unpaid",
      metadata: {},
      customers: {
        id: "cust-unpaid-missing",
        full_name: "Unpaid Missing Customer",
        phone: "09170001111",
        email: "unpaid-missing@example.com",
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    expect(screen.getByText("Unpaid")).toBeTruthy();
    expect(screen.getByText("Payment Due")).toBeTruthy();
    expect(screen.queryByText("Paid")).toBeNull();
  });

  it("completed zero-price service with unpaid status renders Unpaid badge and Payment Due substatus, NOT Paid", () => {
    const booking = makeBooking({
      id: "booking-zero-price-unpaid",
      order_id: null,
      status: "completed",
      booking_progress_status: "completed",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      session_completed_at: "2026-10-29T11:05:00Z",
      payment_status: "unpaid",
      metadata: { price_paid: 0 },
      customers: {
        id: "cust-zero-unpaid",
        full_name: "Zero Price Unpaid Customer",
        phone: "09170002222",
        email: "zero-unpaid@example.com",
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    expect(screen.getByText("Unpaid")).toBeTruthy();
    expect(screen.getByText("Payment Due")).toBeTruthy();
    expect(screen.queryByText("Paid")).toBeNull();
  });

  it("closed no-show booking with historical check-in timestamp renders No-Show pill and disabled No-Show action button, NOT Waiting or Start Service", () => {
    const booking = makeBooking({
      id: "booking-no-show-hist",
      order_id: null,
      status: "no_show",
      booking_progress_status: "no_show",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      customers: {
        id: "cust-noshow",
        full_name: "No Show Customer",
        phone: "09170003333",
        email: "noshow@example.com",
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="owner"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    expect(screen.getAllByText("No-Show").length).toBeGreaterThanOrEqual(2);
    const actionBtn = screen.getByRole("button", { name: "No-Show" });
    expect(actionBtn).toBeTruthy();
    expect(actionBtn.hasAttribute("disabled")).toBe(true);

    expect(screen.queryByText("Waiting")).toBeNull();
    expect(screen.queryByText("Start Service")).toBeNull();
    expect(screen.queryByText("In service")).toBeNull();
  });

  it("closed expired booking with historical check-in timestamp renders Expired pill and disabled Expired action button", () => {
    const booking = makeBooking({
      id: "booking-expired-hist",
      order_id: null,
      status: "expired",
      checked_in_at: "2026-10-29T10:00:00Z",
      customers: {
        id: "cust-expired",
        full_name: "Expired Customer",
        phone: "09170004444",
        email: "expired@example.com",
      },
    });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="owner"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[booking]}
      />
    );

    expect(screen.getAllByText("Expired").length).toBeGreaterThanOrEqual(2);
    const actionBtn = screen.getByRole("button", { name: "Expired" });
    expect(actionBtn).toBeTruthy();
    expect(actionBtn.hasAttribute("disabled")).toBe(true);

    expect(screen.queryByText("Waiting")).toBeNull();
    expect(screen.queryByText("Start Service")).toBeNull();
  });

  it("multi-guest order where guest 1 is closed no-show with old check-in timestamp and guest 2 is waiting targets guest 2 for Start Service, NOT guest 1", async () => {
    const line1 = makeBooking({
      id: "booking-multi-noshow-1",
      order_id: "ORD-MULTI-NOSHOW",
      status: "no_show",
      booking_progress_status: "no_show",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: "2026-10-29T10:05:00Z",
      customers: {
        id: "cust-1",
        full_name: "Guest One",
        phone: "09171110000",
        email: "g1@example.com",
      },
    });

    const line2 = makeBooking({
      id: "booking-multi-waiting-2",
      order_id: "ORD-MULTI-NOSHOW",
      status: "confirmed",
      booking_progress_status: "checked_in",
      checked_in_at: "2026-10-29T10:00:00Z",
      session_started_at: null,
      session_completed_at: null,
      customers: {
        id: "cust-2",
        full_name: "Guest Two",
        phone: "09172220000",
        email: "g2@example.com",
      },
    });

    mocks.crmStartServiceAction.mockResolvedValueOnce({ success: true });

    render(
      <BookingsDesktopWorkspace
        workspaceContext="crm"
        viewerRole="admin"
        date="2026-10-29"
        initialQuickFilter="all"
        bookings={[line1, line2]}
      />
    );

    expect(screen.getByText("Waiting")).toBeTruthy();
    const startBtn = screen.getByRole("button", { name: "Start Service" });
    expect(startBtn).toBeTruthy();

    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mocks.crmStartServiceAction).toHaveBeenCalledWith({
        bookingId: "booking-multi-waiting-2",
      });
    });
  });
});
