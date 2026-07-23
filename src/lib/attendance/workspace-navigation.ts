import type { AttendanceTab } from "@/lib/attendance/types";

export type AttendanceView = "today" | "fix-scan" | "tools";
export type AttendanceTool = "history" | "sessions" | "phones" | "qr" | "reports";

export type AttendanceNavigation = {
  view: AttendanceView;
  tool: AttendanceTool;
};

export const ATTENDANCE_VIEWS: Array<{ key: AttendanceView; label: string }> = [
  { key: "today", label: "Today" },
  { key: "fix-scan", label: "Fix a Scan" },
  { key: "tools", label: "Tools & History" },
];

export const ATTENDANCE_TOOLS: Array<{
  key: AttendanceTool;
  label: string;
  description: string;
}> = [
  {
    key: "history",
    label: "Attendance History",
    description: "View previous clock-in and clock-out records.",
  },
  {
    key: "sessions",
    label: "Service Sessions",
    description: "Review active and completed staff service sessions.",
  },
  {
    key: "phones",
    label: "Staff Phones",
    description: "Connect, replace, disconnect and review staff phones.",
  },
  {
    key: "qr",
    label: "QR Codes",
    description: "Create, preview and print official Attendance QR codes.",
  },
  {
    key: "reports",
    label: "Reports",
    description: "View Attendance summaries, exceptions and exports.",
  },
];

const VIEW_VALUES = new Set<AttendanceView>(["today", "fix-scan", "tools"]);
const TOOL_VALUES = new Set<AttendanceTool>(["history", "sessions", "phones", "qr", "reports"]);

const LEGACY_NAVIGATION: Record<string, AttendanceNavigation> = {
  overview: { view: "today", tool: "history" },
  records: { view: "tools", tool: "history" },
  sessions: { view: "tools", tool: "sessions" },
  qr: { view: "tools", tool: "qr" },
  "qr-codes": { view: "tools", tool: "qr" },
  devices: { view: "tools", tool: "phones" },
  exceptions: { view: "fix-scan", tool: "history" },
  "review-queue": { view: "fix-scan", tool: "history" },
  reports: { view: "tools", tool: "reports" },
};

function first(value: string | string[] | null | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function parseAttendanceNavigation(params: {
  view?: string | string[] | null;
  tool?: string | string[] | null;
  tab?: string | string[] | null;
}): AttendanceNavigation {
  const view = first(params.view);
  const tool = first(params.tool);
  if (VIEW_VALUES.has(view as AttendanceView)) {
    return {
      view: view as AttendanceView,
      tool: TOOL_VALUES.has(tool as AttendanceTool) ? (tool as AttendanceTool) : "history",
    };
  }
  return LEGACY_NAVIGATION[first(params.tab) ?? "overview"] ?? LEGACY_NAVIGATION.overview!;
}

export function navigationFromAttendanceTab(tab: AttendanceTab): AttendanceNavigation {
  return LEGACY_NAVIGATION[tab] ?? LEGACY_NAVIGATION.overview!;
}

export function attendanceWorkspaceHref(
  navigation: AttendanceNavigation,
  options: {
    basePath?: string;
    branchId?: string | null;
    preserve?: URLSearchParams;
    staffId?: string | null;
    date?: string | null;
  } = {}
): string {
  const params = new URLSearchParams({ view: navigation.view });
  if (navigation.view === "tools") params.set("tool", navigation.tool);
  const branchId = options.branchId ?? options.preserve?.get("branchId");
  if (branchId) params.set("branchId", branchId);
  options.preserve?.forEach((value, key) => {
    if (!["view", "tool", "tab", "branchId", "staffId", "date"].includes(key))
      params.append(key, value);
  });
  const staffId = options.staffId ?? options.preserve?.get("staffId");
  const date = options.date ?? options.preserve?.get("date");
  if (staffId) params.set("staffId", staffId);
  if (date) params.set("date", date);
  return `${options.basePath ?? "/crm/attendance"}?${params.toString()}`;
}

export function attendanceViewTabId(view: AttendanceView): string {
  return `attendance-view-tab-${view}`;
}

export function attendanceViewPanelId(view: AttendanceView): string {
  return `attendance-view-panel-${view}`;
}
