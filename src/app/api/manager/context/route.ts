import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBranchServices } from "@/lib/queries/branches";
import { getStaffByBranch } from "@/lib/queries/staff";
import type { Database } from "@/types/supabase";

type BranchContext = Pick<
  Database["public"]["Tables"]["branches"]["Row"],
  "id" | "name" | "slot_interval_minutes"
>;

type StaffContextRow = {
  id: string;
  branch_id: string;
  system_role: string;
  branches: BranchContext | BranchContext[] | null;
};

function firstBranch(value: BranchContext | BranchContext[] | null): BranchContext | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("staff")
    .select("id, branch_id, system_role, branches(id, name, slot_interval_minutes)")
    .eq("auth_user_id", user.id)
    .single();

  const me = (data ?? null) as StaffContextRow | null;
  if (!me || !["manager", "owner"].includes(me.system_role) || !me.branch_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branch = firstBranch(me.branches);
  if (!branch) {
    return NextResponse.json({ error: "Branch context not found" }, { status: 404 });
  }

  const [services, staff, resourcesResult] = await Promise.all([
    getBranchServices(me.branch_id),
    getStaffByBranch(me.branch_id),
    supabase
      .from("branch_resources")
      .select("*")
      .eq("branch_id", me.branch_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return NextResponse.json({
    staffId: me.id,
    branchId: me.branch_id,
    branch,
    services,
    staff,
    resources: resourcesResult.data ?? [],
  });
}
