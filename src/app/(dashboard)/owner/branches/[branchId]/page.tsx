import { notFound } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getBranchDetailAction } from "@/app/(dashboard)/owner/branches/actions";
import { BranchEditForm } from "./branch-edit-form";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type StaffLite = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "full_name" | "tier" | "system_role" | "phone" | "is_active"
>;
type ServiceLite = {
  id: string;
  is_active: boolean;
  custom_price: number | null;
  services: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
};

type BranchDetailPayload = {
  branch: BranchRow;
  services: ServiceLite[];
  staff: StaffLite[];
};

function isBranchDetailPayload(value: unknown): value is BranchDetailPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BranchDetailPayload>;
  return !!candidate.branch && Array.isArray(candidate.services) && Array.isArray(candidate.staff);
}

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const result = await getBranchDetailAction(branchId);

  if ("error" in result || !isBranchDetailPayload(result)) {
    notFound();
  }

  const { branch, services, staff } = result;
  const activeStaffCount = staff.filter((s) => s.is_active).length;
  const activeServiceCount = services.filter((s) => s.is_active).length;

  return (
    <div>
      <PageHeader title={branch.name} description={branch.address} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <BranchEditForm branch={branch} />

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <SectionTitle>Staff ({activeStaffCount} active)</SectionTitle>
            <div
              style={{
                backgroundColor: "var(--ch-surface)",
                border: "1px solid var(--ch-border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {staff.length === 0 ? (
                <div style={{ padding: "1rem", color: "var(--ch-text-muted)", fontSize: "0.875rem" }}>
                  No staff at this branch yet
                </div>
              ) : (
                staff.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.625rem 1rem",
                      borderBottom: i < staff.length - 1 ? "1px solid var(--ch-border)" : "none",
                      opacity: s.is_active ? 1 : 0.5,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        backgroundColor: "var(--ch-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--ch-text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {s.full_name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ch-text)" }}>
                        {s.full_name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
                        {s.tier} · {s.system_role}
                      </div>
                    </div>
                    {!s.is_active && <span style={{ fontSize: "0.7rem", color: "#EF4444" }}>Inactive</span>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <SectionTitle>Services ({activeServiceCount} active)</SectionTitle>
            <div
              style={{
                backgroundColor: "var(--ch-surface)",
                border: "1px solid var(--ch-border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {services.length === 0 ? (
                <div style={{ padding: "1rem", color: "var(--ch-text-muted)", fontSize: "0.875rem" }}>
                  No services configured for this branch
                </div>
              ) : (
                services.map((svc, i) => (
                  <div
                    key={svc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0.625rem 1rem",
                      borderBottom: i < services.length - 1 ? "1px solid var(--ch-border)" : "none",
                      opacity: svc.is_active ? 1 : 0.5,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ch-text)" }}>
                        {svc.services?.name ?? "Unknown service"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
                        {svc.services?.duration_minutes ?? 0} min
                      </div>
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)" }}>
                      {svc.custom_price !== null ? `Custom ₱${svc.custom_price}` : "Default price"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}
