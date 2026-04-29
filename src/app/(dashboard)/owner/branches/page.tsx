import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { getBranchesOverviewAction } from "@/app/(dashboard)/owner/branches/actions";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchOverview = BranchRow & {
  active_staff_count: number;
  todays_bookings: number;
};

export default async function BranchesPage() {
  const result = await getBranchesOverviewAction();
  const branches: BranchOverview[] = "error" in result ? [] : (result as BranchOverview[]);

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Manage spa locations"
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
            <Link href="/owner/branches/new">+ New Branch</Link>
          </Button>
        }
      />

      {branches.length === 0 ? (
        <EmptyState
          title="No branches yet"
          description="Add your first branch to get started."
          action={
            <Button
              asChild
              style={{
                backgroundColor: "var(--ch-accent)",
                color: "#fff",
                border: "none",
              }}
            >
              <Link href="/owner/branches/new">Add Branch</Link>
            </Button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {branches.map((branch) => (
            <Link key={branch.id} href={`/owner/branches/${branch.id}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  backgroundColor: "var(--ch-surface)",
                  border: `1px solid ${branch.is_active ? "var(--ch-border)" : "#FCA5A5"}`,
                  borderRadius: 10,
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: branch.is_active ? "#22C55E" : "#EF4444",
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 500,
                      color: "var(--ch-text)",
                    }}
                  >
                    {branch.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--ch-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {branch.address}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1.5rem", flexShrink: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 600,
                        color: "var(--ch-text)",
                      }}
                    >
                      {branch.active_staff_count}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--ch-text-subtle)",
                      }}
                    >
                      Staff
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 600,
                        color: branch.todays_bookings > 0 ? "var(--ch-accent)" : "var(--ch-text)",
                      }}
                    >
                      {branch.todays_bookings}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--ch-text-subtle)",
                      }}
                    >
                      Today
                    </div>
                  </div>
                </div>

                <div style={{ color: "var(--ch-text-subtle)", fontSize: 18 }}>›</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
