import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  branchId: "sm",
  getFrontDeskContext: vi.fn(),
  getQuickBookingCustomerPrefill: vi.fn(),
  getQuickBookingContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries/crm-context", () => ({
  getFrontDeskContext: mocks.getFrontDeskContext,
}));
vi.mock("@/lib/queries/quick-booking-options", () => ({
  getQuickBookingCustomerPrefill: mocks.getQuickBookingCustomerPrefill,
  getQuickBookingContext: mocks.getQuickBookingContext,
}));
vi.mock("@/components/features/bookings/quick-booking-form", () => ({
  QuickBookingForm: () => null,
}));

import CrmBookingWizardPage from "@/app/(dashboard)/crm/bookings/new/page";
import {
  getAdministrativeBookingCustomerPrefillAction,
  getAdministrativeBookingOptionsAction,
} from "@/lib/actions/administrative-booking";

const customerId = "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d";

beforeEach(() => {
  mocks.branchId = "sm";
  mocks.getFrontDeskContext.mockReset().mockImplementation(async () => ({
    branchId: mocks.branchId,
    branchName: mocks.branchId === "sm" ? "SM Branch" : "Main Spa",
  }));
  mocks.getQuickBookingCustomerPrefill.mockReset().mockResolvedValue(null);
  mocks.getQuickBookingContext.mockReset().mockResolvedValue({
    bookingRules: {},
    services: [],
    staff: [],
    resources: [],
  });
});

describe("Quick Booking customer prefill callers", () => {
  it("uses the server-selected branch in the modal action after a branch switch", async () => {
    expect(await getAdministrativeBookingCustomerPrefillAction({ customerId })).toEqual({
      ok: true,
      customer: null,
    });
    expect(mocks.getQuickBookingCustomerPrefill).toHaveBeenLastCalledWith(customerId, "sm");

    mocks.branchId = "main";
    await getAdministrativeBookingCustomerPrefillAction({ customerId });
    expect(mocks.getQuickBookingCustomerPrefill).toHaveBeenLastCalledWith(customerId, "main");
  });

  it("uses the server-selected branch on the direct Quick Booking page", async () => {
    await CrmBookingWizardPage({ searchParams: Promise.resolve({ customerId }) });
    expect(mocks.getQuickBookingCustomerPrefill).toHaveBeenCalledWith(customerId, "sm");

    mocks.branchId = "main";
    await CrmBookingWizardPage({ searchParams: Promise.resolve({ customerId }) });
    expect(mocks.getQuickBookingCustomerPrefill).toHaveBeenLastCalledWith(customerId, "main");
  });

  it("loads deferred modal options for the current server-selected branch", async () => {
    expect(await getAdministrativeBookingOptionsAction()).toMatchObject({ branchId: "sm" });
    expect(mocks.getQuickBookingContext).toHaveBeenCalledWith("sm");

    mocks.branchId = "main";
    expect(await getAdministrativeBookingOptionsAction()).toMatchObject({ branchId: "main" });
    expect(mocks.getQuickBookingContext).toHaveBeenLastCalledWith("main");
  });
});
