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
  DialogContent: ({ children, className }: { children: React.ReactNode; className: string }) => <div role="dialog" className={className}>{children}</div>,
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
    expect(screen.queryByText(/Asset Library/i)).toBeNull();

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
    expect(screen.getByRole("heading", { name: "Edit Service" })).toBeTruthy();
    for (const heading of ["1. Basic Information", "2. Duration & Pricing", "3. Service Image", "4. Branch Availability", "5. Visibility & Status"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect((screen.getByPlaceholderText("e.g. Swedish Massage") as HTMLInputElement).value).toBe("Swedish Massage");
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/service.webp");
    expect((screen.getByRole("radio", { name: /Extendable/i }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("switch", { name: "Active" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Visible to customers" }).getAttribute("aria-checked")).toBe("true");
    const picker = screen.getByLabelText("Choose service image") as HTMLInputElement;
    const click = vi.spyOn(picker, "click");
    fireEvent.click(screen.getByRole("button", { name: /Change Image/i }));
    expect(click).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(state.save).not.toHaveBeenCalled();
  });

  it("shares the five-section layout and uses accessible switches for service states", async () => {
    state.save.mockResolvedValue({ success: true, serviceId: "new-service-id" });
    render(<ServiceEditorModal open service={null} branches={[{ id: branchId, name: "Main Spa" }]}
      categories={[{ id: categoryId, name: "Massage" }]} onClose={vi.fn()} onSaved={vi.fn()} />);
    for (const heading of ["1. Basic Information", "2. Duration & Pricing", "3. Service Image", "4. Branch Availability", "5. Visibility & Status"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(screen.getByRole("dialog").className).toContain("sm:max-w-[min(920px,92vw)]");
    expect(screen.getByRole("switch", { name: "Active" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Visible to customers" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("switch", { name: "Active" }));
    fireEvent.click(screen.getByRole("switch", { name: "Visible to customers" }));
    expect(screen.getByRole("switch", { name: "Active" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("switch", { name: "Visible to customers" }).getAttribute("aria-checked")).toBe("false");
    expect((screen.getByRole("radio", { name: /Fixed duration/i }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText("Extension Settings")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Extendable/i }));
    expect(screen.getByText("Extension Settings")).toBeTruthy();
    expect(screen.queryByText("Preview Prices")).toBeNull();
    fireEvent.change(screen.getByLabelText(/Price per increment/i), { target: { value: "250" } });
    expect(screen.getByText("Preview Prices")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("e.g. Swedish Massage"), { target: { value: "Swedish Massage" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: categoryId } });
    fireEvent.submit(screen.getByRole("button", { name: "Create Service" }).closest("form")!);
    await waitFor(() => expect(state.save).toHaveBeenCalledOnce());
    expect(JSON.parse(String((state.save.mock.calls[0]![0] as FormData).get("catalog")))).toMatchObject({
      isActive: false, isPublicVisible: false, durationPolicy: "extendable",
    });
  });

  it("locks other branches' offering checkboxes when scoped to a CRM branch on edit", () => {
    const service = {
      id: "service-id", name: "Swedish Massage", description: "Relaxation",
      category_id: categoryId, duration_minutes: 60, price: 800,
      duration_policy: "fixed", extension_increment_minutes: null,
      extension_price: null, maximum_duration_minutes: null,
      is_active: true, is_public_visible: true,
      image_url: null, image_alt: null,
      offeredBranchIds: [branchId],
    } as OwnerService;
    render(<ServiceEditorModal open service={service}
      branches={[{ id: branchId, name: "Main Spa" }, { id: "branch-sm", name: "SM Branch" }]}
      categories={[{ id: categoryId, name: "Massage" }]}
      scopedBranchId="branch-sm"
      scopedBranchName="SM Branch"
      onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText(/Branch offering changes when editing an existing service are scoped to SM Branch/i)).toBeTruthy();
    const mainCheckbox = screen.getByLabelText("Main Spa") as HTMLInputElement;
    const smCheckbox = screen.getByLabelText("SM Branch") as HTMLInputElement;
    expect(mainCheckbox.disabled).toBe(true);
    expect(mainCheckbox.checked).toBe(true);
    expect(smCheckbox.disabled).toBe(false);
    expect(smCheckbox.checked).toBe(false);
  });

  it("defaults to scoped branch, locks all-branches and other branches when scoped to a CRM branch on create", async () => {
    state.save.mockResolvedValue({ success: true, serviceId: "new-service-id" });
    const onSaved = vi.fn();
    render(
      <ServiceEditorModal
        open
        service={null}
        branches={[{ id: branchId, name: "Main Spa" }, { id: "branch-sm", name: "SM Branch" }]}
        categories={[{ id: categoryId, name: "Massage" }]}
        scopedBranchId="branch-sm"
        scopedBranchName="SM Branch"
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    expect(screen.getByText(/New service offerings are scoped to SM Branch/i)).toBeTruthy();
    const allBranchesRadio = screen.getByRole("radio", { name: "All branches" }) as HTMLInputElement;
    const selectedBranchesRadio = screen.getByRole("radio", { name: "Selected branches" }) as HTMLInputElement;
    expect(allBranchesRadio.disabled).toBe(true);
    expect(selectedBranchesRadio.checked).toBe(true);

    const mainCheckbox = screen.getByLabelText("Main Spa") as HTMLInputElement;
    const smCheckbox = screen.getByLabelText("SM Branch") as HTMLInputElement;
    expect(mainCheckbox.disabled).toBe(true);
    expect(mainCheckbox.checked).toBe(false);
    expect(smCheckbox.disabled).toBe(false);
    expect(smCheckbox.checked).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("e.g. Swedish Massage"), { target: { value: "Aromatherapy Massage" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: categoryId } });
    fireEvent.submit(screen.getByRole("button", { name: "Create Service" }).closest("form")!);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());

    const formData = state.save.mock.calls[0]![0] as FormData;
    expect(JSON.parse(String(formData.get("catalog")))).toMatchObject({
      name: "Aromatherapy Massage",
      categoryId,
      allBranches: false,
      branchIds: ["branch-sm"],
    });
  });
});
