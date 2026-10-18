/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceCustomizationTab } from "@/components/features/crm/services/service-customization-tab";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { ServiceTableRow } from "@/components/features/crm/services/types";

vi.mock("@/app/(dashboard)/crm/services/actions", () => ({
  updateBranchServiceHomeServiceAvailabilityAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/owner/branches/actions", () => ({
  updateBranchServiceDeliveryModeAction: vi.fn(),
  updateBranchServiceVisibilityAction: vi.fn(),
}));
vi.mock("@/components/features/crm/services/provider-assignment-sheet", () => ({
  ProviderAssignmentSheet: ({ row, open }: { row: ServiceTableRow; open: boolean }) =>
    open ? <div role="dialog" aria-label={`Providers for ${row.name}`} /> : null,
}));

const service = (id: string, name: string): ActiveBranchService => ({
  id: `branch-${id}`,
  service_id: id,
  is_active: true,
  available_in_spa: true,
  available_home_service: false,
  visibility: "public",
  custom_duration_minutes: null,
  custom_price: null,
  services: {
    id,
    name,
    duration_minutes: 60,
    price: 500,
    service_categories: { id: "massage", name: "Massage" },
  },
}) as ActiveBranchService;

afterEach(cleanup);

describe("unified service workspace", () => {
  it("keeps selection in the detail panel and opens the existing provider sheet for that service", () => {
    const services = [service("a", "Swedish Massage"), service("b", "Thai Massage")];
    render(
      <ServiceCustomizationTab
        branchId="branch-1"
        branchName="Main Spa"
        services={services}
        activeServices={services}
        staff={[]}
        assignments={[]}
        onServicePatch={vi.fn()}
        onAssignmentChange={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Swedish Massage" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View Thai Massage" }));
    expect(screen.getByRole("heading", { name: "Thai Massage" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage providers" }));
    expect(screen.getByRole("dialog", { name: "Providers for Thai Massage" })).toBeTruthy();
  });
});
