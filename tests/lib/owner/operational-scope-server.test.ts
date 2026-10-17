import { beforeEach, describe, expect, it, vi } from "vitest";
const MAIN = "11111111-1111-4111-8111-111111111111";
const SM = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  access: vi.fn(), branches: vi.fn(), staff: { system_role: "owner", branch_id: "11111111-1111-4111-8111-111111111111" },
  user: { id: "owner-user" } as { id: string } | null,
  schedule: vi.fn(), bookings: vi.fn(), dispatch: vi.fn(), frontDesk: vi.fn(), attendanceContext: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/auth/get-user-workspace-access", () => ({ getCurrentUserWorkspaceAccess: mocks.access }));
vi.mock("@/lib/queries/branches", () => ({ getAllBranches: mocks.branches }));
vi.mock("@/lib/dev-bypass", () => ({ isDevAuthBypassEnabled: () => false }));
vi.mock("@/lib/queries/front-desk-branch", () => ({ resolveOwnerFrontDeskBranch: mocks.frontDesk }));
vi.mock("@/lib/queries/dispatch-queries", () => ({ getDispatchData: mocks.dispatch }));
vi.mock("@/lib/attendance/queries", () => ({ getAttendanceActionContext: mocks.attendanceContext }));
vi.mock("@/lib/queries/schedule", () => ({ getDailySchedule: mocks.schedule }));
vi.mock("@/lib/queries/bookings", () => ({ getAllBookings: mocks.bookings, getManagerDashboardStats: async () => ({}) }));
vi.mock("@/components/features/schedule/schedule-workspace", () => ({ ScheduleWorkspace: () => null }));
vi.mock("@/components/features/dispatch/dispatch-workspace", () => ({ HomeServiceDispatchWorkspace: () => null }));
vi.mock("@/lib/logger", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: mocks.staff }), order: async () => ({ data: [] }) };
    return query;
  },
}) }));

import { getOwnerScopeBranches } from "@/lib/owner/operational-scope-server";
import { loadOwnerAttendanceBranch } from "@/lib/attendance/owner-attendance-branch";
import { getOwnerWorkspaceBookingsAction } from "@/app/(dashboard)/owner/bookings/actions";
import OwnerSchedulePage from "@/app/(dashboard)/owner/schedule/page";
import OwnerDispatchPage from "@/app/(dashboard)/owner/dispatch/page";
import { refreshDispatchDataAction } from "@/lib/actions/dispatch-data-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "owner-user" };
  mocks.staff = { system_role: "owner", branch_id: MAIN };
  mocks.access.mockResolvedValue({ user: mocks.user, workspaces: [{ key: "owner" }] });
  mocks.branches.mockResolvedValue([{ id: MAIN, name: "Main", sort_order: 2, is_active: true }, { id: SM, name: "SM", sort_order: 1, is_active: true }]);
  mocks.schedule.mockResolvedValue([]);
  mocks.bookings.mockResolvedValue([]);
  mocks.dispatch.mockResolvedValue({ items: [], today: "2026-10-17" });
  mocks.frontDesk.mockResolvedValue({ id: SM, name: "SM" });
  mocks.attendanceContext.mockResolvedValue({ role: "owner", branchId: SM });
});

describe("Owner server scope authorization and query parity", () => {
  it("requires authenticated Owner access before loading runtime branch identities", async () => {
    mocks.access.mockResolvedValue(null);
    await expect(getOwnerScopeBranches()).rejects.toThrow("redirect:/login");
    expect(mocks.branches).not.toHaveBeenCalled();
    mocks.access.mockResolvedValue({ workspaces: [{ key: "crm" }] });
    await expect(getOwnerScopeBranches()).rejects.toThrow("redirect:");
    expect(mocks.branches).not.toHaveBeenCalled();
  });
  it("sends only active minimal branch metadata to the browser", async () => {
    mocks.branches.mockResolvedValue([{ id: MAIN, name: "Main", sort_order: 2, is_active: true, privateField: "omit" }, { id: SM, is_active: false }]);
    expect(await getOwnerScopeBranches()).toEqual([{ id: MAIN, name: "Main", sort_order: 2 }]);
  });
  it("Schedule queries the validated SM branch and falls back safely for unknown IDs", async () => {
    await OwnerSchedulePage({ searchParams: Promise.resolve({ branchId: SM, date: "2026-10-17" }) });
    expect(mocks.schedule).toHaveBeenLastCalledWith({ branchId: SM, date: "2026-10-17" });
    await OwnerSchedulePage({ searchParams: Promise.resolve({ branchId: "unknown", date: "2026-10-17" }) });
    expect(mocks.schedule).toHaveBeenLastCalledWith({ branchId: MAIN, date: "2026-10-17" });
  });
  it("Attendance preserves its sort-order default and unavailable-branch warning", async () => {
    expect(await loadOwnerAttendanceBranch(null)).toMatchObject({ branch: { id: SM }, warning: null });
    expect(await loadOwnerAttendanceBranch(MAIN)).toMatchObject({ branch: { id: MAIN }, warning: null });
    expect(await loadOwnerAttendanceBranch("unknown")).toMatchObject({ branch: { id: SM }, warning: expect.any(String) });
    expect(await loadOwnerAttendanceBranch([MAIN, SM])).toMatchObject({ branch: { id: SM }, warning: expect.any(String) });
  });
  it("Bookings validates each server request and never broadens invalid scope into an aggregate", async () => {
    await getOwnerWorkspaceBookingsAction({ branchId: SM });
    expect(mocks.bookings).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: SM }));
    await getOwnerWorkspaceBookingsAction({});
    expect(mocks.bookings).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: undefined }));
    mocks.bookings.mockClear();
    expect(await getOwnerWorkspaceBookingsAction({ branchId: "unknown" })).toHaveProperty("error");
    expect(mocks.bookings).not.toHaveBeenCalled();
    mocks.staff.system_role = "crm";
    mocks.branches.mockClear();
    expect(await getOwnerWorkspaceBookingsAction({ branchId: SM })).toEqual({ error: "Unauthorized" });
    expect(mocks.branches).not.toHaveBeenCalled();
  });
  it("Dispatch initial read and refresh use the selected Front Desk SM branch, not the Main profile", async () => {
    const page = await OwnerDispatchPage();
    expect(mocks.frontDesk).toHaveBeenCalledWith("owner-user", MAIN);
    expect(mocks.dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: SM }));
    expect(page.props.ownerBranchId).toBe(SM);
    await refreshDispatchDataAction("2026-10-17", { expectedOwnerBranchId: SM });
    expect(mocks.dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: SM, throwOnError: true }));
  });
  it("rejects Dispatch refresh after preference change rather than populating the old scope", async () => {
    mocks.attendanceContext.mockResolvedValue({ role: "owner", branchId: MAIN });
    expect(await refreshDispatchDataAction("2026-10-17", { expectedOwnerBranchId: SM })).toMatchObject({ success: false });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    mocks.attendanceContext.mockResolvedValue({ role: "crm", branchId: SM });
    expect(await refreshDispatchDataAction("2026-10-17", { expectedOwnerBranchId: SM })).toMatchObject({ success: false });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
