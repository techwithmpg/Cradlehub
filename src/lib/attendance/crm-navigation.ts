import type { AttendanceTab } from "@/lib/attendance/types";

export type CrmAttendanceView = "today" | "review" | "history" | "setup";
export type AttendanceSetupSection = "qr" | "phones" | "rules";

export type CrmAttendanceNavigation = {
  view: CrmAttendanceView;
  section: AttendanceSetupSection;
};

export const CRM_ATTENDANCE_VIEWS: Array<{
  key: CrmAttendanceView;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "review", label: "Review" },
  { key: "history", label: "History" },
  { key: "setup", label: "Setup" },
];

const VIEWS = new Set<CrmAttendanceView>(CRM_ATTENDANCE_VIEWS.map((item) => item.key));
const SECTIONS = new Set<AttendanceSetupSection>(["qr", "phones", "rules"]);

const LEGACY: Record<string, CrmAttendanceNavigation> = {
  overview: { view: "today", section: "qr" },
  sessions: { view: "today", section: "qr" },
  exceptions: { view: "review", section: "qr" },
  "review-queue": { view: "review", section: "qr" },
  records: { view: "history", section: "qr" },
  reports: { view: "history", section: "qr" },
  qr: { view: "setup", section: "qr" },
  "qr-codes": { view: "setup", section: "qr" },
  devices: { view: "setup", section: "phones" },
};

function first(value: string | string[] | null | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function parseCrmAttendanceNavigation(params: {
  view?: string | string[] | null;
  section?: string | string[] | null;
  tab?: string | string[] | null;
}): CrmAttendanceNavigation {
  const view = first(params.view);
  if (VIEWS.has(view as CrmAttendanceView)) {
    const section = first(params.section);
    return {
      view: view as CrmAttendanceView,
      section: SECTIONS.has(section as AttendanceSetupSection)
        ? (section as AttendanceSetupSection)
        : "qr",
    };
  }
  return LEGACY[first(params.tab) ?? "overview"] ?? LEGACY.overview!;
}

export function crmNavigationFromLegacyTab(tab: AttendanceTab): CrmAttendanceNavigation {
  return LEGACY[tab] ?? LEGACY.overview!;
}

export function crmAttendanceHref(
  navigation: CrmAttendanceNavigation,
  preserve?: URLSearchParams
): string {
  const params = new URLSearchParams({ view: navigation.view });
  if (navigation.view === "setup") params.set("section", navigation.section);
  preserve?.forEach((value, key) => {
    if (!["view", "section", "tab"].includes(key)) params.append(key, value);
  });
  return `/crm/attendance?${params.toString()}`;
}

export function crmAttendanceTabId(view: CrmAttendanceView): string {
  return `crm-attendance-tab-${view}`;
}

export function crmAttendancePanelId(view: CrmAttendanceView): string {
  return `crm-attendance-panel-${view}`;
}
