import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { resolveServiceLineQuoteOptions } from "@/lib/services/resolve-service-line-quote";
import { ServiceLineQuoteError } from "@/lib/services/service-line-quote";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  branchId: z.guid(),
  serviceId: z.guid(),
  audience: z.enum(["public", "crm"]),
  deliveryMode: z.enum(["in_spa", "home_service"]),
}).strict();

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.audience === "crm" && !isDevAuthBypassEnabled()) {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { data: staff, error } = await client.from("staff")
      .select("branch_id, system_role").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
    const role = canonicalizeSystemRole(staff?.system_role ?? "");
    if (error || !staff || !canAccessCrmWorkspace(role) ||
        (role !== "owner" && staff.branch_id !== parsed.data.branchId)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }
  }

  try {
    const options = await resolveServiceLineQuoteOptions(parsed.data);
    return NextResponse.json({ options });
  } catch (error) {
    const code = error instanceof ServiceLineQuoteError ? error.code : "SERVICE_DURATION_CONFIGURATION_INVALID";
    return NextResponse.json({ error: "Service duration configuration needs review.", code }, { status: 422 });
  }
}
