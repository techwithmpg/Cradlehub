export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPayrollDashboardData } from "@/lib/queries/payroll";
import { PayrollPageClient } from "@/components/features/payroll/payroll-page-client";

export const metadata: Metadata = { title: "Payroll" };

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || me.system_role !== "owner") redirect("/login");
}

export default async function OwnerPayrollPage() {
  await requireOwner();

  const dashboard = await getPayrollDashboardData();

  return <PayrollPageClient dashboard={dashboard} />;
}
