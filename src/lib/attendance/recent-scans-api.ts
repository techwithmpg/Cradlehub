import "server-only";

import { createAttendanceScanFeedFallback, getRecentAttendanceScanFeed } from "@/lib/attendance/recent-scans";
import type {
  AttendanceScanFeedData,
  AttendanceScanFeedWorkspace,
} from "@/lib/attendance/types";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { hasWorkspaceAccess } from "@/lib/auth/workspace-access";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getDevBypassBranchContext } from "@/lib/dev-bypass-server";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGE = "Attendance activity could not be refreshed.";

type BranchRelation = { name: string | null } | { name: string | null }[] | null;

type FeedRouteResult = { feed: AttendanceScanFeedData; status?: number };

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function branchNameFromRelation(branches: BranchRelation): string | null {
  return first(branches)?.name ?? null;
}

function parseDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getBranchBusinessDate();
}

function parseWorkspace(value: string | null): AttendanceScanFeedWorkspace {
  return value === "owner" ? "owner" : "crm";
}

function parseMaxItems(value: string | null): number {
  const parsed = Number(value ?? 5);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(10, Math.floor(parsed))) : 5;
}

async function resolveCrmFeedContext(): Promise<{ branchId: string; branchName: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin?.branch_id) {
    return {
      branchId: superAdmin.branch_id,
      branchName: branchNameFromRelation(superAdmin.branches) ?? "Branch",
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (me?.branch_id && canAccessCrmWorkspace(me.system_role)) {
    return {
      branchId: me.branch_id,
      branchName: branchNameFromRelation(me.branches as BranchRelation) ?? "Branch",
    };
  }

  if (!isDevAuthBypassEnabled()) return null;

  const devBranch = await getDevBypassBranchContext();
  return devBranch ? { branchId: devBranch.branchId, branchName: devBranch.branchName } : null;
}

async function resolveOwnerBranchName(branchId: string | null): Promise<string | null> {
  if (!branchId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("name")
    .eq("id", branchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.name ?? null;
}

function fallback(params: {
  workspace: AttendanceScanFeedWorkspace;
  selectedDate: string;
  branchId?: string | null;
  branchName?: string | null;
  status?: number;
}): FeedRouteResult {
  return {
    status: params.status,
    feed: createAttendanceScanFeedFallback({
      workspace: params.workspace,
      selectedDate: params.selectedDate,
      branchId: params.branchId,
      branchName: params.branchName,
      error: ERROR_MESSAGE,
    }),
  };
}

export async function getAttendanceScanFeedRouteResult(params: URLSearchParams): Promise<FeedRouteResult> {
  const workspace = parseWorkspace(params.get("workspace"));
  const selectedDate = parseDate(params.get("selectedDate"));
  const maxItems = parseMaxItems(params.get("maxItems"));
  let branchId = params.get("branchId") || null;
  let branchName: string | null = null;

  try {
    if (workspace === "crm") {
      const context = await resolveCrmFeedContext();
      if (!context) return fallback({ workspace, selectedDate, status: 401 });
      branchId = context.branchId;
      branchName = context.branchName;
    } else {
      const access = await getCurrentUserWorkspaceAccess();
      if (!access || !hasWorkspaceAccess(access.workspaces, "owner")) {
        return fallback({ workspace, selectedDate, branchId, status: 401 });
      }
      branchName = await resolveOwnerBranchName(branchId);
    }

    return {
      feed: await getRecentAttendanceScanFeed({
        workspace,
        branchId,
        branchName,
        selectedDate,
        maxItems,
      }),
    };
  } catch {
    return fallback({ workspace, branchId, branchName, selectedDate });
  }
}
