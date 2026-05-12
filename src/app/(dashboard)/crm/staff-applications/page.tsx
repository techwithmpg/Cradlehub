import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllBranches } from "@/lib/queries/branches";
import { OnboardingReviewList } from "@/components/features/staff-onboarding/onboarding-review-list";
import { canReviewStaffOnboarding } from "@/lib/permissions";

export const metadata = { title: "Staff Applications | Front Desk" };

async function requireAuthorizedStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !canReviewStaffOnboarding(me.system_role)) {
    redirect("/crm/today");
  }

  return me;
}

export default async function CrmOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await requireAuthorizedStaff();
  const { status = "submitted" } = await searchParams;

  const admin = createAdminClient();
  
  // CSR can only see requests for their own branch (unless owner/manager)
  let query = admin
    .from("staff_onboarding_requests")
    .select("*")
    .eq("status", status);
  
  if (me.system_role !== "owner" && me.branch_id) {
    query = query.eq("requested_branch_id", me.branch_id);
  }

  const [requestsResult, branches] = await Promise.all([
    query.order("created_at", { ascending: false }),
    getAllBranches(),
  ]);

  const requests = requestsResult.data ?? [];

  return (
    <div>
      <PageHeader
        title="Staff Applications"
        description="Review staff onboarding requests and activate approved operational staff."
        icon="📋"
      />

      <div style={{ 
        marginBottom: "1.5rem", 
        padding: "1rem", 
        backgroundColor: "var(--cs-surface-warm)", 
        borderRadius: 8,
        border: "1px solid var(--cs-border-soft)",
        fontSize: "0.8125rem",
        color: "var(--cs-text-muted)",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem"
      }}>
        <span style={{ fontSize: "1.25rem" }}>ℹ️</span>
        <div>
          <p style={{ margin: 0, fontWeight: 500, color: "var(--cs-text)" }}>MVP Helper Note</p>
          <p style={{ margin: "4px 0 0" }}>
            CSR users can approve only normal operational staff (Therapists, Drivers, Utility, and Front Desk). 
            Management roles require owner or manager approval.
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {(["submitted", "approved", "rejected", "cancelled"] as const).map((s) => (
          <a
            key={s}
            href={`?status=${s}`}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: "0.8125rem",
              fontWeight: status === s ? 600 : 400,
              backgroundColor: status === s ? "var(--cs-sand)" : "var(--cs-surface)",
              color: status === s ? "#fff" : "var(--cs-text-muted)",
              border: `1px solid ${status === s ? "var(--cs-sand)" : "var(--cs-border)"}`,
              textDecoration: "none",
              textTransform: "capitalize",
            }}
          >
            {s}
          </a>
        ))}
      </div>

      <OnboardingReviewList
        requests={requests}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        reviewerSystemRole={me.system_role}
        reviewerBranchId={me.branch_id}
      />
    </div>
  );
}
