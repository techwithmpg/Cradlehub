import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/features/dashboard/role-badge";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getAllStaff, getPendingStaff } from "@/lib/queries/staff";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import type { Database } from "@/types/supabase";

type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchRel = { id: string; name: string } | { id: string; name: string }[] | null;
type StaffWithBranch = StaffRow & { branches: BranchRel };

type BranchGroup = {
  branchId: string;
  branchName: string;
  staff: StaffWithBranch[];
};

const TIER_LABELS: Record<string, string> = {
  senior: "Senior",
  mid: "Mid",
  junior: "Junior",
};

function readBranchName(relation: BranchRel): string {
  if (!relation) return "Unassigned Branch";
  if (Array.isArray(relation)) return relation[0]?.name ?? "Unassigned Branch";
  return relation.name;
}

function groupStaffByBranch(staff: StaffWithBranch[]): BranchGroup[] {
  const map = new Map<string, BranchGroup>();
  for (const member of staff) {
    const key = member.branch_id ?? "__unassigned__";
    const existing = map.get(key);
    if (existing) {
      existing.staff.push(member);
    } else {
      map.set(key, {
        branchId: key,
        branchName: readBranchName(member.branches),
        staff: [member],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.branchId === "__unassigned__") return 1;
    if (b.branchId === "__unassigned__") return -1;
    return a.branchName.localeCompare(b.branchName);
  });
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default async function OwnerStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = resolvedSearchParams.tab === "pending" ? "pending" : "active";

  const [allStaff, pendingStaff] = await Promise.all([
    activeTab === "active" ? getAllStaff() : Promise.resolve([]),
    getPendingStaff(),
  ]);

  const typedAllStaff = allStaff as StaffWithBranch[];
  const typedPending = pendingStaff as StaffWithBranch[];

  const grouped = groupStaffByBranch(typedAllStaff);
  const pendingGrouped = groupStaffByBranch(typedPending);

  const awaitingCount = typedPending.filter((s) => s.auth_user_id !== null).length;
  const invitedCount = typedPending.filter((s) => s.auth_user_id === null).length;

  return (
    <div>
      <PageHeader
        title="Staff"
        description={`${typedAllStaff.filter((s) => s.is_active).length} active · ${awaitingCount} awaiting approval · ${invitedCount} invites sent`}
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              asChild
              size="sm"
              variant="outline"
              style={{ borderColor: "var(--cs-border)", color: "var(--cs-text)" }}
            >
              <Link href="/owner/staff/invite">🔗 Invite Link</Link>
            </Button>
            <Button
              asChild
              size="sm"
              style={{
                backgroundColor: "var(--cs-sand)",
                color: "#fff",
                border: "none",
              }}
            >
              <Link href="/owner/staff/new">+ Direct Invite</Link>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {[
          { key: "active", label: "Active Staff" },
          { key: "pending", label: `Pending (${typedPending.length})` },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/owner/staff?tab=${tab.key}`}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: isActive ? "var(--cs-sand-mist)" : "var(--cs-surface)",
                color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
                fontSize: "0.8125rem",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {activeTab === "active" && (
        <>
          {typedAllStaff.length === 0 ? (
            <EmptyState
              title="No staff yet"
              description="Invite your first team member to get started."
              action={
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button asChild style={{ backgroundColor: "var(--cs-sand)", color: "#fff", border: "none" }}>
                    <Link href="/owner/staff/invite">🔗 Invite Link</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/owner/staff/new">+ Direct Invite</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {grouped.map(({ branchId, branchName, staff }) => (
                <div key={branchId}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--cs-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.625rem",
                    }}
                  >
                    <span>{branchName}</span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "var(--cs-text-muted)",
                        backgroundColor: "var(--cs-border)",
                        padding: "1px 6px",
                        borderRadius: 9999,
                        textTransform: "none",
                        letterSpacing: 0,
                      }}
                    >
                      {staff.length}
                    </span>
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--cs-surface)",
                      border: "1px solid var(--cs-border)",
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
                          borderBottom: i < staff.length - 1 ? "1px solid var(--cs-border)" : "none",
                          textDecoration: "none",
                          opacity: s.is_active ? 1 : 0.5,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            backgroundColor: "var(--cs-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "var(--cs-text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          {s.full_name.charAt(0)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>
                            {s.full_name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                            {STAFF_TYPE_LABELS[s.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? s.staff_type}
                            {s.is_head && " · Head"}
                            {" · "}{TIER_LABELS[s.tier] ?? s.tier}
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

                        <div style={{ color: "var(--cs-text-muted)", fontSize: 16 }}>›</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {typedPending.length === 0 ? (
            <EmptyState
              title="No pending staff"
              description="Generate an invite link to add new team members."
              action={
                <Button asChild style={{ backgroundColor: "var(--cs-sand)", color: "#fff", border: "none" }}>
                  <Link href="/owner/staff/invite">🔗 Generate Invite Link</Link>
                </Button>
              }
            />
          ) : (
            pendingGrouped.map(({ branchId, branchName, staff: pendingInBranch }) => (
              <div key={branchId}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--cs-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.625rem",
                  }}
                >
                  <span>{branchName}</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "var(--cs-text-muted)",
                      backgroundColor: "var(--cs-border)",
                      padding: "1px 6px",
                      borderRadius: 9999,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    {pendingInBranch.length}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: "var(--cs-surface)",
                    border: "1px solid var(--cs-border)",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {pendingInBranch.map((s, i) => {
                    const isClaimed = s.auth_user_id !== null;
                    const age = daysSince(s.created_at);
                    const expiresIn = Math.max(0, 7 - age);
                    const rowStyle = {
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                      padding: "0.75rem 1rem",
                      borderBottom: i < pendingInBranch.length - 1 ? "1px solid var(--cs-border)" : "none",
                      textDecoration: "none",
                    } as const;

                    if (isClaimed) {
                      return (
                        <Link key={s.id} href={`/owner/staff/${s.id}`} style={rowStyle}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              backgroundColor: "var(--cs-sand-mist)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "var(--cs-sand)",
                              flexShrink: 0,
                            }}
                          >
                            {s.full_name.charAt(0)}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>
                              {s.full_name}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                              {s.phone && s.phone !== "0000000000" && `${s.phone} · `}
                              Awaiting approval
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--cs-sand)",
                              backgroundColor: "var(--cs-sand-mist)",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            Review & Approve
                          </span>

                          <div style={{ color: "var(--cs-text-muted)", fontSize: 16 }}>›</div>
                        </Link>
                      );
                    }

                    return (
                      <div key={s.id} style={rowStyle}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            backgroundColor: "var(--cs-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "var(--cs-text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          ?
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text-muted)" }}>
                            Invite link generated
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                            {expiresIn > 0
                              ? `Expires in ${expiresIn} day${expiresIn !== 1 ? "s" : ""}`
                              : "Expired"}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--cs-text-muted)",
                            backgroundColor: "var(--cs-border)",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          Not claimed
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
