/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingForSection, BookingWizard } from "@/components/public/booking-wizard";
import { BookingServicePicker } from "@/components/public/booking-service-picker";

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));
vi.mock("@/components/public/service-image", () => ({
  ServiceImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const attendees = [
  { id: "att-1", name: "Guest 1 (You)", isOrganizer: true, serviceIds: ["massage"] },
  { id: "att-2", name: "Guest 2", isOrganizer: false, serviceIds: [] },
];

describe("public booking service step controls", () => {
  it("keeps the existing recipient choices accessible and reveals compact guest controls", () => {
    const onBookingForChange = vi.fn();
    const onSelectAttendee = vi.fn();
    const onRemoveAttendee = vi.fn();
    const onAddAttendee = vi.fn();

    const props = {
      onBookingForChange,
      recipientName: "",
      onRecipientNameChange: vi.fn(),
      attendees,
      activeAttendeeId: "att-1",
      onSelectAttendee,
      onAddAttendee,
      onRemoveAttendee,
      onRenameAttendee: vi.fn(),
      mode: "public" as const,
    };

    const view = render(<BookingForSection {...props} bookingFor="me" />);
    expect((screen.getByRole("radio", { name: "Me" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText("Guest Sessions")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Me + Guests" }));
    expect(onBookingForChange).toHaveBeenCalledWith("me_and_others");

    view.rerender(<BookingForSection {...props} bookingFor="me_and_others" />);
    expect(
      screen.getByRole("button", { name: /You, 1 service selected/i }).getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Guest 2, 0 services selected/i }));
    expect(onSelectAttendee).toHaveBeenCalledWith("att-2");
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    expect(onAddAttendee).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Remove Guest 2" }));
    expect(onRemoveAttendee).toHaveBeenCalledWith("att-2");

    view.rerender(<BookingForSection {...props} bookingFor="someone_else" />);
    expect((screen.getByRole("radio", { name: "Someone Else" }) as HTMLInputElement).checked).toBe(
      true
    );
    expect(screen.getByText("Recipient Full Name *")).toBeTruthy();
    expect(screen.queryByText("Guest Sessions")).toBeNull();
  });

  it("keeps categories and service selection available below the attendee heading", () => {
    const onToggle = vi.fn();
    render(
      <BookingServicePicker
        heading="Treatment for Guest 2"
        services={[
          {
            id: "massage",
            name: "Massage",
            durationMinutes: 60,
            price: 1000,
            categoryName: "Massage",
          },
          { id: "facial", name: "Facial", durationMinutes: 45, price: 800, categoryName: "Facial" },
        ]}
        loading={false}
        selected={[]}
        onToggle={onToggle}
        totalDuration={0}
        totalPrice={0}
        visitType="in_spa"
      />
    );

    expect(screen.getByRole("heading", { name: "Treatment for Guest 2" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Facial" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: /Select Facial/i })[0]!);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "facial" }));
  });

  it("keeps each guest's service when switching and allows the existing Continue flow", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    vi.stubGlobal("scrollTo", vi.fn());
    Element.prototype.scrollTo = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const data =
          url === "/api/branches"
            ? { branches: [{ id: "qa-branch", name: "QA Branch" }] }
            : url.startsWith("/api/public/booking-context")
              ? {
                  services: [
                    {
                      serviceId: "massage",
                      name: "QA Massage",
                      durationMinutes: 60,
                      price: 1000,
                      categoryName: "Massage",
                      availableInSpa: true,
                    },
                    {
                      serviceId: "facial",
                      name: "QA Facial",
                      durationMinutes: 45,
                      price: 800,
                      categoryName: "Facial",
                      availableInSpa: true,
                    },
                  ],
                  staff: [],
                  bookingRules: null,
                }
              : { slots: [] };
        if (url.startsWith("/api/public/booking-context")) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return { json: async () => data } as Response;
      })
    );

    render(<BookingWizard />);
    fireEvent.click(await screen.findByRole("button", { name: /QA Branch/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(await screen.findByRole("heading", { name: "Choose your treatment" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Me + Guests" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Massage" })[0]!);
    fireEvent.click((await screen.findAllByRole("button", { name: /Select QA Massage/i }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Guest 2, 0 services selected/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Facial" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: /Select QA Facial/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /You, 1 service selected/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Massage" })[0]!);

    expect(
      screen.getByRole("button", { name: /You, 1 service selected/i }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getAllByRole("button", { name: /Select QA Massage/i })[0]!.getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByRole("button", { name: /Guest 2, 1 service selected/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    expect(
      screen
        .getByRole("button", { name: /Guest 3, 0 services selected/i })
        .getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.click(screen.getAllByRole("button", { name: /Select QA Massage/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Remove Guest 3" }));
    expect(screen.queryByRole("button", { name: /Guest 3, /i })).toBeNull();
    expect(screen.getByRole("button", { name: /Guest 2, 1 service selected/i })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Continue/i }).hasAttribute("disabled")).toBe(false)
    );
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(await screen.findByRole("heading", { name: /Date/i })).toBeTruthy();
  });
});
