import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Invite Staff" };

async function requireOwnerOrManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !["owner", "manager", "assistant_manager", "store_manager"].includes(me.system_role)) {
    redirect("/owner");
  }

  return me;
}

export default async function InvitePage() {
  const me = await requireOwnerOrManager();

  const onboardingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/staff-onboarding`.trim() || "https://your-domain.com/staff-onboarding";
  const accessCode = process.env.STAFF_ONBOARDING_ACCESS_CODE ?? "";

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader
        title="Invite Staff"
        description="Share the public onboarding link with new applicants. They will self-onboard and appear in Onboarding Requests for review."
      />
      <InviteForm
        onboardingUrl={onboardingUrl}
        accessCode={accessCode}
        isOwner={me.system_role === "owner"}
      />
    </div>
  );
}
