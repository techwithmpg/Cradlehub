import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingProgress } from "@/components/features/booking/booking-progress";
import { SlotPicker } from "@/components/features/booking/slot-picker";
import { getBranchById, getBranchServices } from "@/lib/queries/branches";
import { getServiceById } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type BranchServiceRow = Pick<
  Database["public"]["Tables"]["branch_services"]["Row"],
  "id" | "is_active"
>;
type BranchServiceWithService = BranchServiceRow & {
  services:
    | Pick<ServiceRow, "id">[]
    | Pick<ServiceRow, "id">
    | null;
};

function firstServiceId(
  relation: BranchServiceWithService["services"]
): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.id ?? null;
  return relation.id;
}

export default async function SelectTimePage({
  params,
}: {
  params: Promise<{ branchId: string; serviceId: string }>;
}) {
  const { branchId, serviceId } = await params;

  const [branchRaw, serviceRaw, branchServicesRaw] = await Promise.all([
    getBranchById(branchId),
    getServiceById(serviceId),
    getBranchServices(branchId),
  ]);

  const branch = branchRaw as BranchRow | null;
  const service = serviceRaw as ServiceRow | null;
  const branchServices = branchServicesRaw as BranchServiceWithService[];

  const offeredAtBranch = branchServices.some((entry) => firstServiceId(entry.services) === serviceId);

  if (!branch || !branch.is_active || !service || !service.is_active || !offeredAtBranch) {
    notFound();
  }

  const confirmBase = `/book/confirm?branchId=${branchId}&serviceId=${serviceId}`;

  return (
    <div>
      <BookingProgress currentStep={3} />

      <div style={{ marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href={`/book/${branchId}`}
          style={{
            fontSize: "0.8125rem",
            color: "var(--ch-text-muted)",
            textDecoration: "none",
          }}
        >
          ← Back
        </Link>
        <span style={{ color: "var(--ch-text-subtle)" }}>·</span>
        <span style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)" }}>{branch.name}</span>
      </div>

      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--ch-text)",
          marginBottom: "0.25rem",
        }}
      >
        {service.name}
      </h2>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--ch-text-muted)",
          marginBottom: "1.5rem",
        }}
      >
        {service.duration_minutes} minutes · Select your preferred date and time
      </p>

      <SlotPicker branchId={branchId} serviceId={serviceId} confirmUrl={confirmBase} />
    </div>
  );
}
