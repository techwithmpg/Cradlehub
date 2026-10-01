/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicStepDetails } from "@/components/public/booking-wizard";

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));

afterEach(() => cleanup());

const form = {
  fullName: "",
  phone: "",
  email: "",
  notes: "",
  hsAddress: "",
  hsAddressDetails: "",
  hsBarangay: "",
  hsCity: "",
  hsLandmark: "",
  hsParkingNotes: "",
  hsZone: "",
  hsLat: null,
  hsLng: null,
  hsPlaceId: "",
  hsFormattedAddress: "",
  hsAddressComponents: [],
  hsMapUrl: "",
  paymentMethod: "",
  paymentReference: "",
  paymentNote: "",
};

describe("public Details step", () => {
  it("keeps required contact fields and therapist choice visible while disclosing optional fields on request", () => {
    const onChange = vi.fn();
    render(
      <PublicStepDetails
        form={form}
        onChange={onChange}
        error=""
        bookingFor="me_and_others"
        attendees={[
          { id: "att-1", name: "You", isOrganizer: true, serviceIds: ["svc-1"] },
          { id: "att-2", name: "Guest 2", isOrganizer: false, serviceIds: ["svc-2"] },
        ]}
        availableStaff={[]}
        selectedSlot={null}
        selectedStaff="auto"
        onSelectStaff={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: /Full name/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Phone number/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose a therapist: Any available therapist/ }).textContent).toContain(
      "Any available therapist"
    );
    expect(screen.getByText(/2 guests · We'll assign one qualified therapist/i)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /Email/i })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Special requests/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add email or special request" }));
    expect(screen.getByRole("textbox", { name: /Email/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Special requests/i })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: /Email/i }), {
      target: { value: "guest@example.com" },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ email: "guest@example.com" }));
  });
});
