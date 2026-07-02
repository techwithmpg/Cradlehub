import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllBranches } from "@/lib/queries/branches";
import { OnboardingReviewList } from "@/components/features/staff-onboarding/onboarding-review-list";
import { getOpenWorkflowTasksAction } from "@/lib/notifications/workflow-queries";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canReviewStaffOnboarding } from "@/lib/permissions";

export const metadata = { title: "Onboarding Requests" };

export default async function ManagerOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !canReviewStaffOnboarding(me.system_role)) redirect("/manager");
  if (!me.branch_id) redirect("/manager");
  const reviewerSystemRole = canonicalizeSystemRole(me.system_role);

  const { status = "submitted" } = await searchParams;

  const admin = createAdminClient();
  const [requestsResult, branches, workflowTasks] = await Promise.all([
    admin
      .from("staff_onboarding_requests")
      .select("*")
      .eq("status", status)
      .eq("requested_branch_id", me.branch_id)
      .order("created_at", { ascending: false }),
    getAllBranches(),
    getOpenWorkflowTasksAction(50),
  ]);

  const requests = requestsResult.data ?? [];
  const branchOptions = branches
    .filter((b) => b.id === me.branch_id)
    .map((b) => ({ id: b.id, name: b.name }));

  return (
    <div>
      <PageHeader
        title="Onboarding Requests"
        description="Review and approve staff applications for your branch."
        icon="📋"
      />

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
        branches={branchOptions}
        reviewerSystemRole={reviewerSystemRole}
        reviewerBranchId={me.branch_id}
        workflowTasks={workflowTasks.filter(
          (task) => task.entity_type === "staff_onboarding_request"
        )}
      />
    </div>
  );
}
