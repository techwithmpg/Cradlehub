/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceCustomizationTable } from "@/components/features/crm/services/service-customization-table";
import type { CustomizationRow } from "@/components/features/crm/services/customization-rows";

const updateHomeService = vi.fn();

vi.mock("next/image", () => ({ default: () => <span data-testid="mock-image" /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(dashboard)/crm/services/actions", () => ({
  updateBranchServiceHomeServiceAvailabilityAction: (input: unknown) => updateHomeService(input),
}));

function row(id: string, name: string, isHomeService = false): CustomizationRow {
  return {
    branchServiceId: `branch-${id}`,
    serviceId: id,
    name,
    category: "Massage",
    description: null,
    duration: 60,
    price: 1000,
    imageUrl: null,
    isActive: true,
    isInSpa: true,
    isHomeService,
    visibility: "public",
    deliveryMode: isHomeService ? "both" : "in_spa",
    assignedProviders: [],
    providerCount: 0,
    isReady: false,
    readinessIssues: ["Missing provider"],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

beforeEach(() => updateHomeService.mockReset());
afterEach(cleanup);

describe("ServiceCustomizationTable Home Service mutation", () => {
  it("optimistically updates and disables only the affected switch", async () => {
    const request = deferred<Record<string, unknown>>();
    updateHomeService.mockReturnValue(request.promise);
    const onServicePatch = vi.fn();
    render(
      <ServiceCustomizationTable
        branchId="branch-1"
        rows={[row("service-1", "Thai Massage"), row("service-2", "Swedish Massage")]}
        selectedRow={null}
        onSelect={vi.fn()}
        onServicePatch={onServicePatch}
      />
    );

    const target = screen.getByRole("switch", { name: "Home Service for Thai Massage" });
    const other = screen.getByRole("switch", { name: "Home Service for Swedish Massage" });
    fireEvent.click(target);

    expect(target.getAttribute("aria-checked")).toBe("true");
    expect((target as HTMLButtonElement).disabled).toBe(true);
    expect(other.getAttribute("aria-checked")).toBe("false");
    expect((other as HTMLButtonElement).disabled).toBe(false);

    request.resolve({
      success: true,
      savedAvailableHomeService: true,
      branchService: { available_home_service: true },
    });
    await waitFor(() =>
      expect(onServicePatch).toHaveBeenCalledWith("service-1", {
        available_home_service: true,
      })
    );
  });

  it("rolls the optimistic value back when the save fails", async () => {
    updateHomeService.mockResolvedValue({ success: false, error: "Save failed" });
    render(
      <ServiceCustomizationTable
        branchId="branch-1"
        rows={[row("service-1", "Thai Massage", true)]}
        selectedRow={null}
        onSelect={vi.fn()}
        onServicePatch={vi.fn()}
      />
    );

    const target = screen.getByRole("switch", { name: "Home Service for Thai Massage" });
    fireEvent.click(target);
    expect(target.getAttribute("aria-checked")).toBe("false");
    await waitFor(() => expect(target.getAttribute("aria-checked")).toBe("true"));
  });
});
