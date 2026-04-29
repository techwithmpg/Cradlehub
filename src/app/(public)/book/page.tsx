import Link from "next/link";
import { BookingProgress } from "@/components/features/booking/booking-progress";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getAllBranches } from "@/lib/queries/branches";
import type { Database } from "@/types/supabase";

type BranchListItem = Pick<Database["public"]["Tables"]["branches"]["Row"], "id" | "name" | "address">;

export default async function BookPage() {
  const branches = (await getAllBranches()) as BranchListItem[];

  return (
    <div>
      <BookingProgress currentStep={1} />

      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--ch-text)",
          marginBottom: "0.375rem",
        }}
      >
        Choose a location
      </h2>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--ch-text-muted)",
          marginBottom: "1.5rem",
        }}
      >
        Select the branch you&apos;d like to visit
      </p>

      {branches.length === 0 ? (
        <EmptyState
          title="No branches available"
          description="Please check back soon or contact us directly."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {branches.map((branch) => (
            <Link key={branch.id} href={`/book/${branch.id}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  backgroundColor: "var(--ch-surface)",
                  border: "1.5px solid var(--ch-border)",
                  borderRadius: 12,
                  padding: "1.25rem",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "var(--ch-accent-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 20,
                  }}
                >
                  🏠
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--ch-text)" }}>
                    {branch.name}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--ch-text-muted)", marginTop: 2 }}>
                    {branch.address}
                  </div>
                </div>
                <div style={{ color: "var(--ch-accent)", fontSize: 20, flexShrink: 0 }}>→</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
