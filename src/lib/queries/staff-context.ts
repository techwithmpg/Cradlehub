import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";

export type SharedStaffProfileRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  system_role: string;
  staff_type: string | null;
  branch_id: string;
  avatar_url: string | null;
  branches: { name: string } | { name: string }[] | null;
};

export type LayoutStaffContext = {
  user: { id: string };
  me: SharedStaffProfileRow | null;
};

export const getLayoutStaffContext = cache(async (): Promise<LayoutStaffContext | null> => {
  try {
    const hdrs = await headers();
    const verifiedUserId = hdrs.get("x-cradle-verified-user-id");
    const verifiedStaffEncoded = hdrs.get("x-cradle-verified-staff-json");
    if (verifiedUserId && verifiedStaffEncoded) {
      const me = JSON.parse(decodeURIComponent(verifiedStaffEncoded)) as SharedStaffProfileRow;
      return { user: { id: verifiedUserId }, me };
    }
  } catch {
    // Fallback to standard Supabase lookup if headers() is unavailable
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    return {
      user: { id: user.id },
      me: {
        id: user.id,
        full_name: superAdmin.full_name,
        nickname: null,
        system_role: "owner",
        staff_type: "managerial",
        branch_id: superAdmin.branch_id,
        avatar_url: null,
        branches: superAdmin.branches,
      },
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, full_name, nickname, system_role, staff_type, branch_id, avatar_url, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logError("staff_context.lookup_failed", { error });
  }

  return { user: { id: user.id }, me: (me as SharedStaffProfileRow | null) ?? null };
});
