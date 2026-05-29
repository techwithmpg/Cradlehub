export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { logInfo } from "@/lib/logger";
import { CrmTabNav, DISPATCH_TABS } from "@/components/features/crm/crm-tab-nav";

export const metadata: Metadata = { title: "Home Service Dispatch — CRM" };

const ALLOWED_ROLES = [
  "owner", "manager", "assistant_manager", "store_manager",
  "crm", "csr", "csr_head", "csr_staff",
];

export default async function CrmDispatchPage() {
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
  if (!me.branch_id) redirect("/login");

  const today = new Date().toISOString().split("T")[0]!;
  const data = await getDispatchData({ branchId: me.branch_id, date: today });

  logInfo("dispatch.queue.loaded", {
    role: me.system_role,
    branchId: me.branch_id,
    date: today,
    count: data.items.length,
  });

  return (
    <>
      <CrmTabNav tabs={DISPATCH_TABS} activeHref="/crm/dispatch" />
      <HomeServiceDispatchWorkspace role="crm" data={data} />
    </>
  );
}
