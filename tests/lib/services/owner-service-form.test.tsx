/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/features/marketing/shared/marketing-media-field", () => ({
  MarketingMediaField: ({ onChange }: { onChange: (url: string, alt: string) => void }) => (
    <button type="button" onClick={() => onChange("https://example.com/replacement.webp", "Replacement alt")}>
      Choose replacement
    </button>
  ),
}));

import { OwnerServiceForm, OwnerServiceImageField } from "@/app/(dashboard)/owner/services/[serviceId]/owner-service-form";

afterEach(cleanup);

describe("Owner service editor", () => {
  it("submits image URL and alt text from the same media selector used by Marketing", () => {
    const { container } = render(
      <OwnerServiceImageField imageUrl="/images/services/old.webp" imageAlt="Old alt" mediaAssets={[]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose replacement" }));
    expect(container.querySelector<HTMLInputElement>('input[name="imageUrl"]')?.value)
      .toBe("https://example.com/replacement.webp");
    expect((screen.getByLabelText("Image Alt Text") as HTMLInputElement).value).toBe("Replacement alt");
  });

  it("shows a failed save while keeping entered form data for retry", async () => {
    const action = vi.fn(async () => ({ success: false, error: "Service update was not permitted." }));
    render(
      <OwnerServiceForm action={action}>
        <input aria-label="Service Name" name="name" defaultValue="Original" />
        <button type="submit">Save Changes</button>
      </OwnerServiceForm>
    );
    const name = screen.getByRole("textbox", { name: "Service Name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Revised" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not permitted"));
    expect(name.value).toBe("Revised");
  });
});
