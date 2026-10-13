import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveWorkspaceModule,
  type RetainedModuleId,
  type RetainedWorkspace,
} from "@/components/features/dashboard/workspace-retention-policy";

const destinations: ReadonlyArray<{
  workspace: RetainedWorkspace;
  route: string;
  moduleId: RetainedModuleId;
  page: string;
}> = [
  { workspace: "crm", route: "/crm/today", moduleId: "crm-work-queue", page: "crm/today" },
  { workspace: "crm", route: "/crm/bookings", moduleId: "crm-bookings", page: "crm/bookings" },
  { workspace: "crm", route: "/crm/schedule", moduleId: "crm-schedule", page: "crm/schedule" },
  {
    workspace: "crm",
    route: "/crm/attendance",
    moduleId: "crm-attendance",
    page: "crm/attendance",
  },
  { workspace: "crm", route: "/crm/customers", moduleId: "crm-customers", page: "crm/customers" },
  { workspace: "crm", route: "/crm/dispatch", moduleId: "crm-dispatch", page: "crm/dispatch" },
  { workspace: "crm", route: "/crm/cash-flow", moduleId: "crm-cash-flow", page: "crm/cash-flow" },
  { workspace: "owner", route: "/owner", moduleId: "owner-overview", page: "owner" },
  {
    workspace: "owner",
    route: "/owner/bookings",
    moduleId: "owner-bookings",
    page: "owner/bookings",
  },
  {
    workspace: "owner",
    route: "/owner/schedule",
    moduleId: "owner-schedule",
    page: "owner/schedule",
  },
  {
    workspace: "owner",
    route: "/owner/attendance",
    moduleId: "owner-attendance",
    page: "owner/attendance",
  },
  {
    workspace: "owner",
    route: "/owner/cash-flow",
    moduleId: "owner-cash-flow",
    page: "owner/cash-flow",
  },
  { workspace: "owner", route: "/owner/reports", moduleId: "owner-reports", page: "owner/reports" },
  {
    workspace: "owner",
    route: "/owner/dispatch",
    moduleId: "owner-dispatch",
    page: "owner/dispatch",
  },
];

describe("primary retained workspace destinations", () => {
  it.each(destinations)(
    "$route resolves and registers $moduleId",
    ({ workspace, route, moduleId, page }) => {
      expect(resolveWorkspaceModule(workspace, route)?.moduleId).toBe(moduleId);
      const source = readFileSync(
        join(process.cwd(), "src/app/(dashboard)", page, "page.tsx"),
        "utf8"
      );
      expect(source).toContain(`<RetainedWorkspaceModule moduleId="${moduleId}">`);
    }
  );
});
