"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAllBranches } from "@/lib/queries/branches";
import { getStaffServices } from "@/lib/queries/staff";
import { getAssignableServicesForStaff } from "@/lib/services/service-catalog";

const staffIdSchema = z.guid("Invalid staff ID");

export async function getOwnerStaffEditContextAction(rawStaffId: string) {
  const parsed = staffIdSchema.safeParse(rawStaffId);
  if (!parsed.success) return { ok: false as const, error: "Invalid staff ID." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false as const, error: "You must sign in." };

  const { data: actor, error: actorError } = await supabase
    .from("staff")
    .select("id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (actorError || !actor || actor.system_role !== "owner") {
    return { ok: false as const, error: "Owner access required." };
  }

  const { data: target, error: targetError } = await supabase
    .from("staff")
    .select("id")
    .eq("id", parsed.data)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false as const, error: "Staff profile not found or unavailable." };
  }

  try {
    const [branches, services, staffServiceIds] = await Promise.all([
      getAllBranches(),
      getAssignableServicesForStaff(parsed.data, { useAdminClient: true }),
      getStaffServices(parsed.data),
    ]);
    return {
      ok: true as const,
      branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
      services,
      staffServiceIds,
    };
  } catch {
    return {
      ok: false as const,
      error: "Could not load the staff editing options. Please try again.",
    };
  }
}
