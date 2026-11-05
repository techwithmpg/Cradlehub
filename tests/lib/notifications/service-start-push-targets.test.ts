import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { candidatePushWorkspaces } from "@/lib/notifications/push/delivery";

describe("two-minute therapist reminder recipient isolation", () => {
  it("only queries staff subscriptions for a scheduled therapist reminder", () => {
    expect(candidatePushWorkspaces({
      target_workspace: "staff",
      metadata: { service_start_reminder: true },
    })).toEqual(["staff"]);
  });

  it("retains existing owner-copy behavior for other booking notices", () => {
    expect(candidatePushWorkspaces({
      target_workspace: "staff",
      metadata: {},
    })).toEqual(["owner", "staff"]);
    expect(candidatePushWorkspaces({
      target_workspace: "crm",
      metadata: {},
    })).toEqual(["owner", "crm"]);
  });
});
