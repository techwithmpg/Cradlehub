import { describe, expect, it } from "vitest";
import { getAgentCoachAvailability } from "@/lib/agents/config";

const configured = {
  ANTHROPIC_API_KEY: "sk-ant-api03-release-readiness-test-key",
  AGENT_COACH_WORKSPACES: "crm,owner",
};

describe("Agent Coach availability", () => {
  it("is available only with a valid key, enabled workspace, and allowed role", () => {
    expect(getAgentCoachAvailability({ workspace: "crm", role: "crm", env: configured }))
      .toEqual({ available: true, reason: "available" });
  });

  it("is unavailable when the provider key is missing", () => {
    expect(getAgentCoachAvailability({
      workspace: "crm",
      role: "crm",
      env: { AGENT_COACH_WORKSPACES: "crm" },
    }).reason).toBe("provider_unconfigured");
  });

  it("is unavailable when the workspace is disabled", () => {
    expect(getAgentCoachAvailability({
      workspace: "owner",
      role: "owner",
      env: { ...configured, AGENT_COACH_WORKSPACES: "crm" },
    }).reason).toBe("workspace_disabled");
  });

  it("is unavailable to a role that cannot access the requested coach", () => {
    expect(getAgentCoachAvailability({ workspace: "crm", role: "staff", env: configured }).reason)
      .toBe("role_not_allowed");
  });
});
