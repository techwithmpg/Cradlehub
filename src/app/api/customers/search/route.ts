import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchCustomerIdentities } from "@/lib/queries/customers";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { resolveOwnerFrontDeskBranch } from "@/lib/queries/front-desk-branch";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("staff")
    .select("system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const role = me ? canonicalizeSystemRole(me.system_role) : null;
  if (!me || !role || !canAccessCrmWorkspace(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const ownerBranch =
    role === "owner" ? await resolveOwnerFrontDeskBranch(user.id, me.branch_id) : null;
  const branchId = ownerBranch?.id ?? me.branch_id;
  if (!branchId || (role === "owner" && !ownerBranch)) {
    return NextResponse.json({ error: "Front Desk branch unavailable" }, { status: 403 });
  }
  const customers = await searchCustomerIdentities(q);
  return NextResponse.json({ customers });
}
