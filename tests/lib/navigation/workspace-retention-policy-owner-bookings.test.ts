import { describe, expect, it } from "vitest";
import { resolveWorkspaceModule } from "@/components/features/dashboard/workspace-retention-policy";
import { isRetainedWorkspaceEnabled } from "@/lib/config/mvp-flags";

describe("PERF-9B Owner Bookings retained URL metadata", () => {
  it("preserves stable filters, tab, search and selected booking", () => {
    const params = new URLSearchParams({
      date: "2026-10-18", branch: "main", status: "confirmed", type: "online",
      search: "Alice", tab: "upcoming", bookingId: "booking-1",
      openRoomAssignment: "1", highlight: "booking-2",
    });
    const descriptor = resolveWorkspaceModule("owner", "/owner/bookings", params);
    const saved = new URLSearchParams(descriptor?.stableSearchState);
    expect(descriptor?.moduleId).toBe("owner-bookings");
    expect(saved.get("branch")).toBe("main");
    expect(saved.get("tab")).toBe("upcoming");
    expect(saved.get("bookingId")).toBe("booking-1");
    expect(saved.get("search")).toBe("Alice");
    expect(saved.get("date")).toBe("2026-10-18");
    expect(saved.get("status")).toBe("confirmed");
    expect(saved.get("type")).toBe("online");
    expect(saved.has("openRoomAssignment")).toBe(false);
    expect(saved.has("highlight")).toBe(false);
  });

  it("does not treat child pages as retained Owner Bookings", () => {
    expect(resolveWorkspaceModule("owner", "/owner/bookings/new", "")).toBeNull();
  });

  it("does not enable Owner retention under the CRM-only flag", () => {
    expect(isRetainedWorkspaceEnabled("owner", {
      NEXT_PUBLIC_RETAINED_WORKSPACES: "crm",
    })).toBe(false);
  });
});
