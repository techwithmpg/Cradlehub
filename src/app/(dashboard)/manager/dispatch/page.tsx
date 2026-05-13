export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeServiceDispatchWorkspace } from "@/features/dispatch";

export const metadata: Metadata = { title: "Home Service Dispatch — Manager" };

const ALLOWED_ROLES = ["owner", "manager", "assistant_manager", "store_manager"];

export default async function ManagerDispatchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !ALLOWED_ROLES.includes(me.system_role)) redirect("/login");

  return <HomeServiceDispatchWorkspace role="manager" />;
}
