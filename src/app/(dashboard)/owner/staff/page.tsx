import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/features/dashboard/role-badge";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getAllStaff } from "@/lib/queries/staff";
import type { Database } from "@/types/supabase";

type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchRel = { id: string; name: string } | { id: string; name: string }[] | null;
type StaffWithBranch = StaffRow & { branches: BranchRel };

const TIER_LABELS: Record<string, string> = {
  senior: "Senior",
  mid: "Mid",
  junior: "Junior",
};

function readBranchName(relation: BranchRel): string {
  if (!relation) return "Unknown branch";
  if (Array.isArray(relation)) return relation[0]?.name ?? "Unknown branch";
  return relation.name;
}

export default async function OwnerStaffPage() {
  const allStaff = (await getAllStaff()) as StaffWithBranch[];

  const groupsMap = new Map<string, { name: string; staff: StaffWithBranch[] }>();
  allStaff.forEach((staffMember) => {
    const key = staffMember.branch_id;
    const existing = groupsMap.get(key);
    if (existing) {
      existing.staff.push(staffMember);
      return;
    }
    groupsMap.set(key, {
      name: readBranchName(staffMember.branches),
      staff: [staffMember],
    });
  });

  const grouped = Array.from(groupsMap.entries())
    .map(([branchId, value]) => ({ branchId, branchName: value.name, staff: value.staff }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName));

  return (
    <div>
      <PageHeader
        title="Staff"
        description={`${allStaff.filter((s) => s.is_active).length} active across ${grouped.length} branches`}
        action={
          <Button
            asChild
            size="sm"
            style={{
              backgroundColor: "var(--ch-accent)",
              color: "#fff",
              border: "none",
            }}
          >
            <Link href="/owner/staff/new">+ Invite Staff</Link>
          </Button>
        }
      />

      {allStaff.length === 0 ? (
        <EmptyState
          title="No staff yet"
          description="Invite your first team member to get started."
          action={
            <Button
              asChild
              style={{
                backgroundColor: "var(--ch-accent)",
                color: "#fff",
                border: "none",
              }}
            >
              <Link href="/owner/staff/new">Invite Staff</Link>
            </Button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {grouped.map(({ branchId, branchName, staff }) => (
            <div key={branchId}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--ch-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.625rem",
                }}
              >
                {branchName}
              </div>
              <div
                style={{
                  backgroundColor: "var(--ch-surface)",
                  border: "1px solid var(--ch-border)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {staff.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/owner/staff/${s.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                      padding: "0.75rem 1rem",
                      borderBottom: i < staff.length - 1 ? "1px solid var(--ch-border)" : "none",
                      textDecoration: "none",
                      opacity: s.is_active ? 1 : 0.5,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        backgroundColor: "var(--ch-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--ch-text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {s.full_name.charAt(0)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--ch-text)",
                        }}
                      >
                        {s.full_name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--ch-text-muted)",
                        }}
                      >
                        {TIER_LABELS[s.tier] ?? s.tier}
                        {s.phone && ` · ${s.phone}`}
                      </div>
                    </div>

                    <RoleBadge role={s.system_role} />

                    {!s.is_active && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "#EF4444",
                          backgroundColor: "#FEF2F2",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        Inactive
                      </span>
                    )}

                    <div style={{ color: "var(--ch-text-subtle)", fontSize: 16 }}>›</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
