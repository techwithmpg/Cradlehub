import { notFound } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getBranchDetailAction } from "@/app/(dashboard)/owner/branches/actions";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { BranchEditForm } from "./branch-edit-form";
import { BranchBookingRulesForm } from "./branch-booking-rules-form";
import { BranchResourcesManager } from "./branch-resources-manager";
import { BranchServicesPanel } from "./branch-services-panel";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];
type StaffLite = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "full_name" | "tier" | "system_role" | "phone" | "is_active"
>;
type ServiceLite = {
  id: string;
  is_active: boolean;
  custom_price: number | null;
  available_in_spa: boolean;
  available_home_service: boolean;
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
  resources: ResourceRow[];
};

function isBranchDetailPayload(value: unknown): value is BranchDetailPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BranchDetailPayload>;
  return (
    !!candidate.branch &&
    Array.isArray(candidate.services) &&
    Array.isArray(candidate.staff) &&
    Array.isArray(candidate.resources)
  );
}

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const [result, bookingRules] = await Promise.all([
    getBranchDetailAction(branchId),
    getBranchBookingRulesOrDefault(branchId),
  ]);

  if ("error" in result || !isBranchDetailPayload(result)) {
    notFound();
  }

  const { branch, services, staff, resources } = result;
  const activeStaffCount = staff.filter((s) => s.is_active).length;

  return (
    <div>
      <PageHeader title={branch.name} description={branch.address} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <BranchEditForm branch={branch} />
          <BranchBookingRulesForm rules={bookingRules} />
          <BranchResourcesManager branchId={branch.id} resources={resources} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <SectionTitle>Staff ({activeStaffCount} active)</SectionTitle>
            <div
              style={{
                backgroundColor: "var(--cs-surface)",
                border: "1px solid var(--cs-border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {staff.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
                  No staff members assigned to this branch.
                </div>
              ) : (
                staff.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.625rem 1rem",
                      borderBottom: i < staff.length - 1 ? "1px solid var(--cs-border)" : "none",
                      opacity: s.is_active ? 1 : 0.5,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>
                        {s.full_name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", textTransform: "capitalize" }}>
                        {s.tier} · {s.system_role.replace(/_/g, " ")}
                      </div>
                    </div>
                    {!s.is_active && (
                      <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "#991B1B", backgroundColor: "#FEF2F2", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                        Inactive
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <BranchServicesPanel branchId={branch.id} services={services as ServiceLite[]} />
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
        color: "var(--cs-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "0.625rem",
      }}
    >
      {children}
    </div>
  );
}
