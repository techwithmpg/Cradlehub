/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildServiceTableRows,
  CrmTherapistAssignmentTab,
} from "@/components/features/crm/services/crm-therapist-assignment-tab";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import type { ServiceTableRow } from "@/components/features/crm/services/types";

vi.mock("@/components/features/crm/services/service-assignment-table-row", () => ({
  ServiceAssignmentTableRow: ({ row }: { row: ServiceTableRow }) => (
    <tr data-testid={"service-" + row.serviceId}>
      <td>{row.name}</td>
      <td>{row.assignedProviders.length} providers</td>
    </tr>
  ),
}));

const member = (id: string, staffType: string, systemRole = "staff") => ({
  id,
  full_name: id,
  staff_type: staffType,
  system_role: systemRole,
  is_active: true,
}) as StaffForServicePanel;

const service = (id: string, name: string, home = false): ActiveBranchService => ({
  id: "branch-service-" + id,
  service_id: id,
  is_active: true,
  available_in_spa: !home,
  available_home_service: home,
  visibility: "public",
  custom_duration_minutes: null,
  custom_price: null,
  services: {
    id,
    name,
    duration_minutes: 60,
    price: 500,
    service_categories: { id: "category", name: "Massage" },
  },
}) as ActiveBranchService;

const t = member("Therapist One", "therapist");
const driver = member("Driver One", "driver", "driver");
const services = [
  service("service-a", "Swedish Massage"),
  service("service-b", "Thai Massage"),
  service("service-c", "Home Massage", true),
];
const assignments: ServiceAssignmentRow[] = [
  { staff_id: t.id, service_id: "service-b" },
  { staff_id: driver.id, service_id: "service-a" },
];

afterEach(cleanup);

describe("CRM Setup provider assignment usability", () => {
  it("does not treat an ineligible driver as a service provider", () => {
    const result = buildServiceTableRows(services, [t, driver], assignments);
    expect(result[0]?.assignedProviders).toHaveLength(0);
    expect(result[0]?.isCritical).toBe(true);
    expect(result[1]?.assignedProviders.map((row) => row.id)).toEqual([t.id]);
    expect(result[0]?.assignableProviders.map((row) => row.id)).toEqual([t.id]);
  });

  it("keeps all service rows, offers a one-click missing-provider filter, and allows clearing", () => {
    render(
      <CrmTherapistAssignmentTab
        branchId="branch-1"
        services={services}
        staff={[t, driver]}
        assignments={assignments}
        onAssignmentChange={vi.fn()}
        onServicePatch={vi.fn()}
      />
    );

    expect(screen.getByTestId("service-service-a")).toBeTruthy();
    expect(screen.getByTestId("service-service-b")).toBeTruthy();
    expect(screen.getByTestId("service-service-c")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Needs provider/i }));
    expect(screen.getByTestId("service-service-a")).toBeTruthy();
    expect(screen.queryByTestId("service-service-b")).toBeNull();
    expect(screen.getByTestId("service-service-c")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /All services/i }));
    expect(screen.getByTestId("service-service-b")).toBeTruthy();
  });

  it("preserves category and home-service filters inside the disclosure", () => {
    render(
      <CrmTherapistAssignmentTab
        branchId="branch-1"
        services={services}
        staff={[t, driver]}
        assignments={assignments}
        onAssignmentChange={vi.fn()}
        onServicePatch={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Category & delivery"));
    fireEvent.change(screen.getByLabelText("Filter delivery"), { target: { value: "home" } });
    expect(screen.getByTestId("service-service-c")).toBeTruthy();
    expect(screen.queryByTestId("service-service-a")).toBeNull();
    expect(screen.queryByTestId("service-service-b")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("service-service-a")).toBeTruthy();
  });
});
