import { describe, expect, it } from "vitest";
import {
  affectedModulesForBookingChange,
  resolveWorkspaceModule,
} from "@/components/features/dashboard/workspace-retention-policy";

describe("PERF-5 CRM Dispatch retention policy", () => {
  it("registers Home Service Dispatch as one retained CRM module with canonical query restoration", () => {
    const descriptor = resolveWorkspaceModule(
      "crm",
      "/crm/dispatch",
      "tab=upcoming&bookingId=booking-42&ignored=value"
    );

    expect(descriptor).toMatchObject({
      workspace: "crm",
      moduleId: "crm-dispatch",
      normalizedRoute: "/crm/dispatch",
      stableSearchState: "bookingId=booking-42&tab=upcoming",
      staleTimeMs: 12_000,
      cost: "high",
    });
  });

  it("bridges the legacy booking event to Dispatch without changing unrelated retention policy", () => {
    expect(affectedModulesForBookingChange("crm")).toEqual([
      "crm-work-queue",
      "crm-bookings",
      "crm-schedule",
      "crm-dispatch",
    ]);
  });
});
