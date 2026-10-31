// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CrmAvailabilitySnapshot,
  CrmAvailabilityStaffRow,
} from "@/lib/queries/crm-availability";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/config/mvp-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/mvp-flags")>()),
  MVP_CHECKIN_PAUSED: false,
}));

import { CrmAvailabilityClient } from "@/components/features/crm/availability/crm-availability-client";

function staffRow(overrides: Partial<CrmAvailabilityStaffRow>): CrmAvailabilityStaffRow {
  return {
    staff_id: "staff-1",
    staff_name: "Ava Santos",
    staff_type: "therapist",
    system_role: "staff",
    is_driver: false,
    is_service_provider: true,
    scheduleStatus: "scheduled",
    liveStatus: "not_checked_in",
    presenceStatus: "not_checked_in",
    checkedInAt: null,
    checkedOutAt: null,
    checkInId: null,
    work_start: "09:00",
    work_end: "18:00",
    scheduleSource: "individual",
    scheduleConflictCode: null,
    scheduleConflictReason: null,
    shifts: [{ shift_type: "single", start_time: "09:00", end_time: "18:00" }],
    active_booking: null,
    blocks: [],
    needsAttention: false,
    ...overrides,
  };
}

const snapshot = {
  asOf: "2026-10-31T09:00:00.000Z",
  staff: [
    staffRow({}),
    staffRow({
      staff_id: "driver-1",
      staff_name: "Ben Cruz",
      staff_type: "driver",
      is_driver: true,
      is_service_provider: false,
      liveStatus: "available_now",
      presenceStatus: "checked_in",
    }),
  ],
} as CrmAvailabilitySnapshot;

afterEach(cleanup);

describe("CRM availability attendance controls", () => {
  it("keeps presence status and routes enabled attendance actions to audited review", () => {
    render(<CrmAvailabilityClient snapshot={snapshot} />);

    for (const tab of ["Live Board", "Staff List", "Driver Readiness"]) {
      if (tab !== "Live Board") {
        fireEvent.click(screen.getAllByRole("button", { name: new RegExp(tab) })[0]!);
      }
      const links = screen.getAllByRole("link", { name: /Review attendance for/ });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link.getAttribute("href")).toBe("/crm/attendance?tab=exceptions");
      }
      expect(screen.queryByRole("button", { name: /^Check (in|out)/i })).toBeNull();
    }
  });
});
