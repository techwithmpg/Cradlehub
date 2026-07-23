import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync(
  "src/components/features/attendance/crm-attendance-workspace.tsx",
  "utf8"
);
const ownerWorkspace = readFileSync(
  "src/components/features/attendance/attendance-workspace.tsx",
  "utf8"
);
const realtime = readFileSync(
  "src/components/features/attendance/use-attendance-workspace-realtime.ts",
  "utf8"
);
const setup = readFileSync(
  "src/components/features/attendance/setup/attendance-setup-view.tsx",
  "utf8"
);
const history = readFileSync(
  "src/components/features/attendance/history/attendance-history-view.tsx",
  "utf8"
);
const review = readFileSync(
  "src/components/features/attendance/review/attendance-review-drawer.tsx",
  "utf8"
);

describe("ATTENDANCE-UX-001 preservation contract", () => {
  it("keeps every former functional area available through four CRM workspaces", () => {
    for (const component of [
      "AttendanceTodayView",
      "AttendanceReviewView",
      "AttendanceHistoryView",
      "AttendanceSetupView",
    ])
      expect(workspace).toContain(component);
    for (const component of ["AttendanceQrSetup", "AttendancePhonesSetup", "AttendanceRulesSetup"])
      expect(setup).toContain(component);
    expect(history).toContain("loadAttendanceHistoryAction");
    expect(review).toContain("AttendanceCorrectionDialog");
    expect(review).toContain("AttendanceScheduleDialog");
  });

  it("keeps one scoped Realtime subscription and does not introduce router refresh", () => {
    expect(realtime.match(/supabase\.channel\(/g)).toHaveLength(1);
    expect(`${workspace}\n${realtime}\n${setup}`).not.toContain("router.refresh(");
  });

  it("retains the Owner Attendance client while CRM uses the redesigned client", () => {
    expect(ownerWorkspace).toContain("AttendanceTabs");
    expect(ownerWorkspace).toContain("AttendanceTabContent");
    expect(workspace).not.toContain("AttendanceTabs");
  });
});
