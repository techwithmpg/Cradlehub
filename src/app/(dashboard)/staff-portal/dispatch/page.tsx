export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeServiceDispatchWorkspace } from "@/features/dispatch";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home Service Dispatch - Therapist" };

const SERVICE_ROLES = ["owner", "manager", "service_head", "service_staff", "staff"];

async function requireServiceDispatchAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) {
    if (isDevAuthBypassEnabled()) return;
    redirect("/login");
  }

  if (!SERVICE_ROLES.includes(me.system_role)) {
    redirect("/driver");
  }
}

export default async function StaffDispatchPage() {
  await requireServiceDispatchAccess();

  return <HomeServiceDispatchWorkspace role="therapist" />;
}
