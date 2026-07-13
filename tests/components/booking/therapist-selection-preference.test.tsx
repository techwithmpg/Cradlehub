/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TherapistSelectionStep } from "@/components/features/booking/therapist-picker/therapist-selection-step";

afterEach(() => cleanup());

describe("public therapist preference selection", () => {
  it("shows Any available provider as the selected default", () => {
    render(
      <TherapistSelectionStep
        options={[]}
        value="auto"
        onValueChange={vi.fn()}
        serviceCount={1}
        totalDuration={60}
        totalPriceLabel="₱1,000"
        preferenceConfirmationRequired
      />
    );

    expect(
      screen
        .getByRole("button", { name: /Any available provider/i })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getByText(/Our team will confirm a manual preference/i)
    ).toBeTruthy();
  });
});
