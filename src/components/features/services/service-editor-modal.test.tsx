// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceEditorModal } from "./service-editor-modal";
import type { OwnerService } from "./owner-service-types";

const state = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/(dashboard)/owner/services/actions", () => ({ saveOwnerServiceCatalogAction: state.save }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("next/image", () => ({ default: ({ alt, src }: { alt: string; src: string }) => {
  // Test stub: image optimization is covered by the production build.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={src} />;
} }));

const branchId = "c1000000-0000-0000-0000-000000000001";
const categoryId = "c2000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Owner service modal", () => {
  it("opens the native picker directly, previews a file, and commits only on Save", async () => {
    const onSaved = vi.fn();
    state.save.mockResolvedValue({ success: true, serviceId: "new-service-id" });
    render(<ServiceEditorModal open service={null} branches={[{ id: branchId, name: "Main Spa" }]}
      categories={[{ id: categoryId, name: "Massage" }]} onClose={vi.fn()} onSaved={onSaved} />);
    const picker = screen.getByLabelText("Choose service image") as HTMLInputElement;
    const click = vi.spyOn(picker, "click");
    fireEvent.click(screen.getByRole("button", { name: /upload service image/i }));
    expect(click).toHaveBeenCalledOnce();
    expect(state.save).not.toHaveBeenCalled();

    const file = new File(["image"], "photo.webp", { type: "image/webp" });
    fireEvent.change(picker, { target: { files: [file] } });
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:preview");
    fireEvent.change(screen.getByPlaceholderText("e.g. Swedish Massage"), { target: { value: "Swedish Massage" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: categoryId } });
    fireEvent.submit(screen.getByRole("button", { name: "Create Service" }).closest("form")!);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const formData = state.save.mock.calls[0]![0] as FormData;
    expect(JSON.parse(String(formData.get("catalog")))).toMatchObject({
      name: "Swedish Massage", categoryId, durationPolicy: "fixed", allBranches: true,
    });
    expect(formData.get("image")).toBe(file);
  });

  it("keeps the form open after a failed save so the Owner can retry", async () => {
    const onSaved = vi.fn();
    state.save.mockResolvedValueOnce({ success: false, error: "Storage unavailable" })
      .mockResolvedValueOnce({ success: true, serviceId: "new-service-id" });
    render(<ServiceEditorModal open service={null} branches={[{ id: branchId, name: "Main Spa" }]}
      categories={[{ id: categoryId, name: "Massage" }]} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Swedish Massage"), { target: { value: "Swedish Massage" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: categoryId } });
    const form = screen.getByRole("button", { name: "Create Service" }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Storage unavailable"));
    expect(onSaved).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText("e.g. Swedish Massage") as HTMLInputElement).value).toBe("Swedish Massage");
    fireEvent.submit(form);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it("loads the canonical edit values, changes image through the picker, and cancels without saving", () => {
    const onClose = vi.fn();
    const service = {
      id: "service-id", name: "Swedish Massage", description: "Relaxation",
      category_id: categoryId, duration_minutes: 60, price: 800,
      duration_policy: "extendable", extension_increment_minutes: 30,
      extension_price: 400, maximum_duration_minutes: 180,
      is_active: true, is_public_visible: true,
      image_url: "https://example.com/service.webp", image_alt: "Massage treatment",
      offeredBranchIds: [branchId],
    } as OwnerService;
    render(<ServiceEditorModal open service={service}
      branches={[{ id: branchId, name: "Main Spa" }, { id: "branch-two", name: "SM Branch" }]}
      categories={[{ id: categoryId, name: "Massage" }]} onClose={onClose} onSaved={vi.fn()} />);
    expect((screen.getByPlaceholderText("e.g. Swedish Massage") as HTMLInputElement).value).toBe("Swedish Massage");
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/service.webp");
    expect((screen.getByRole("radio", { name: /Extendable/i }) as HTMLInputElement).checked).toBe(true);
    const picker = screen.getByLabelText("Choose service image") as HTMLInputElement;
    const click = vi.spyOn(picker, "click");
    fireEvent.click(screen.getByRole("button", { name: /Change Image/i }));
    expect(click).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(state.save).not.toHaveBeenCalled();
  });
});
