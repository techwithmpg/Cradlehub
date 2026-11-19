import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import {
  evaluateBranchSummarySafe,
  scheduleBranchOptimizationReevaluation,
} from "@/lib/optimization/auto-reevaluate";
import { resolveOwnerFrontDeskBranch } from "@/lib/queries/front-desk-branch";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branchId: z.guid().optional(),
  syncAlerts: z.boolean().optional(),
});

async function authenticateCrmCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Sign in required." };

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      ok: true as const,
      staffId: null as string | null,
      defaultBranchId: mock.branch_id,
      userId: user.id,
      role: mock.system_role,
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .is("archived_at", null)
    .is("merged_into_staff_id", null)
    .maybeSingle();

  const role = me ? canonicalizeSystemRole(me.system_role) : null;
  if (!me || !role || !canAccessCrmWorkspace(role)) {
    return { ok: false as const, status: 403, error: "CRM workspace authorization required." };
  }

  return {
    ok: true as const,
    staffId: me.id,
    defaultBranchId: me.branch_id,
    userId: user.id,
    role,
  };
}

async function resolveTargetBranch(
  caller: Extract<Awaited<ReturnType<typeof authenticateCrmCaller>>, { ok: true }>,
  requestedBranchId?: string
) {
  if (caller.role === "owner") {
    const ownerBranch = await resolveOwnerFrontDeskBranch(caller.userId, caller.defaultBranchId);
    const branchId = requestedBranchId ?? ownerBranch?.id ?? caller.defaultBranchId;
    if (!branchId) {
      return { ok: false as const, status: 400, error: "No branch selected." };
    }
    return { ok: true as const, branchId };
  }

  if (!caller.defaultBranchId) {
    return {
      ok: false as const,
      status: 403,
      error: "Staff account has no assigned branch.",
    };
  }

  if (requestedBranchId && requestedBranchId !== caller.defaultBranchId) {
    return {
      ok: false as const,
      status: 403,
      error: "Cannot access optimization state for another branch.",
    };
  }

  return { ok: true as const, branchId: caller.defaultBranchId };
}

async function handleEvaluate(
  caller: Extract<Awaited<ReturnType<typeof authenticateCrmCaller>>, { ok: true }>,
  params: z.infer<typeof querySchema>,
  allowWrites: boolean
) {
  const branchRes = await resolveTargetBranch(caller, params.branchId);
  if (!branchRes.ok) {
    return NextResponse.json({ error: branchRes.error }, { status: branchRes.status });
  }

  const date = params.date ?? getBranchBusinessDate();
  const safe = await evaluateBranchSummarySafe({
    branchId: branchRes.branchId,
    date,
    bypassCache: Boolean(params.syncAlerts),
    syncAlerts: allowWrites && Boolean(params.syncAlerts),
    actorStaffId: caller.staffId,
  });

  if (allowWrites && params.syncAlerts && !safe.ok) {
    scheduleBranchOptimizationReevaluation({
      branchId: branchRes.branchId,
      date,
      reason: "api_retry",
      actorStaffId: caller.staffId,
    });
  }

  return NextResponse.json(
    {
      ok: safe.ok,
      unavailable: !safe.ok,
      evaluation: safe.evaluation,
      summary: safe.summary,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const caller = await authenticateCrmCaller();
    if (!caller.ok) {
      return NextResponse.json({ error: caller.error }, { status: caller.status });
    }
    const sp = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      date: sp.get("date") ?? undefined,
      branchId: sp.get("branchId") ?? undefined,
      syncAlerts: sp.get("syncAlerts") === "1" || sp.get("syncAlerts") === "true" ? true : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid optimization query parameters." }, { status: 400 });
    }
    return await handleEvaluate(caller, parsed.data, false);
  } catch {
    return NextResponse.json({ error: "Failed to evaluate branch schedule." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await authenticateCrmCaller();
    if (!caller.ok) {
      return NextResponse.json({ error: caller.error }, { status: caller.status });
    }
    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid optimization payload." }, { status: 400 });
    }
    return await handleEvaluate(caller, parsed.data, true);
  } catch {
    return NextResponse.json({ error: "Failed to evaluate branch schedule." }, { status: 500 });
  }
}
