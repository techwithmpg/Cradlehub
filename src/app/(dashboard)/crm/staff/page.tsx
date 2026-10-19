import { redirect } from "next/navigation";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { CrmStaffWorkspace } from "@/components/features/crm/staff/crm-staff-workspace";
import {
  normalizeCrmStaffTab,
} from "@/components/features/crm/staff/crm-staff-workspace-data";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { loadCrmStaffWorkspaceData } from "@/lib/queries/crm-staff-workspace";

export const metadata = { title: "Staff | Front Desk" };

export default async function CrmStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const [result, params] = await Promise.all([
    loadCrmStaffWorkspaceData(),
    searchParams,
  ]);

  if (result.status === "unauthorized") redirect("/crm");

  if (result.status === "missing_branch") {
    return (
      <CrmOperationalPageShell
        title="Staff & Access"
        description="Manage staff, access, invitations, and onboarding readiness."
        context="Branch required"
      >
        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-sm text-[var(--cs-text-muted)]">
          Your profile is not linked to an active branch. Contact your manager or owner to assign you to a branch.
        </div>
      </CrmOperationalPageShell>
    );
  }

  const initialTab = normalizeCrmStaffTab(params.tab);
  const { data } = result;

  return (
    <RetainedWorkspaceModule moduleId="crm-staff">
      <CrmOperationalPageShell
        title="Staff & Access"
        description="Manage staff, access, invitations, and onboarding readiness."
        context={`${data.branchName} · ${data.reviewerSystemRole}`}
      >
        <CrmStaffWorkspace
          initialTab={initialTab}
          initialData={data}
        />
      </CrmOperationalPageShell>
    </RetainedWorkspaceModule>
  );
}
