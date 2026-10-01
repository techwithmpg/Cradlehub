/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/features/marketing/shared/marketing-media-field", () => ({
  MarketingMediaField: ({ value, onChange }: { value: string; onChange: (url: string, alt: string) => void }) => (
    <button type="button" onClick={() => onChange("/new-service.webp", "New treatment photo") }>
      {value ? "Replace image" : "Choose image"}
    </button>
  ),
}));

import { ServiceImageFields } from "@/components/features/owner/service-image-fields";

describe("Owner service image fields", () => {
  it("uses the shared media field and submits its image URL and edited alt text", () => {
    const { container } = render(
      <ServiceImageFields imageUrl="/old.webp" imageAlt="Old image" mediaAssets={[]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Replace image" }));
    fireEvent.change(screen.getByLabelText("Image Alt Text"), { target: { value: "Accessible treatment photo" } });
    expect((container.querySelector('input[name="imageUrl"]') as HTMLInputElement).value).toBe("/new-service.webp");
    expect((container.querySelector('input[name="imageAlt"]') as HTMLInputElement).value).toBe("Accessible treatment photo");
  });
});
