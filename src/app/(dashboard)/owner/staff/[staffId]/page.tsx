import { notFound } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getAllStaff } from "@/lib/queries/staff";
import { getAllBranches } from "@/lib/queries/branches";
import type { Database } from "@/types/supabase";
import { StaffEditForm } from "./staff-edit-form";

type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchRel = { id: string; name: string } | { id: string; name: string }[] | null;
type StaffWithBranch = StaffRow & { branches: BranchRel };

function readBranchName(relation: BranchRel): string {
  if (!relation) return "Unknown branch";
  if (Array.isArray(relation)) return relation[0]?.name ?? "Unknown branch";
  return relation.name;
}

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  const [allStaff, branches] = await Promise.all([getAllStaff(), getAllBranches()]);
  const typedStaff = allStaff as StaffWithBranch[];
  const typedBranches = branches as BranchRow[];
  const staffMember = typedStaff.find((s) => s.id === staffId);

  if (!staffMember) {
    notFound();
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader
        title={staffMember.full_name}
        description={`${readBranchName(staffMember.branches)} · ${staffMember.system_role}`}
      />
      <StaffEditForm staffMember={staffMember} branches={typedBranches} />
    </div>
  );
}
