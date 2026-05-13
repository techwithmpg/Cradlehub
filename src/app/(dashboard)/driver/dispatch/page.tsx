export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeServiceDispatchWorkspace } from "@/features/dispatch";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home Service Dispatch - Driver" };

async function requireDriverDispatchAccess() {
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

  if (me.system_role !== "owner" && me.system_role !== "driver") {
    redirect("/staff-portal");
  }
}

export default async function DriverDispatchPage() {
  await requireDriverDispatchAccess();

  return <HomeServiceDispatchWorkspace role="driver" />;
}
