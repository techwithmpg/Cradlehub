import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingProgress } from "@/components/features/booking/booking-progress";
import { getBranchById, getBranchServices } from "@/lib/queries/branches";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchServiceRow = Pick<
  Database["public"]["Tables"]["branch_services"]["Row"],
  "id" | "custom_price" | "is_active"
>;
type ServiceRow = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  "id" | "name" | "description" | "duration_minutes" | "price"
>;
type CategoryRow = Pick<
  Database["public"]["Tables"]["service_categories"]["Row"],
  "id" | "name" | "display_order"
>;

type OneOrMany<T> = T | T[] | null;
type CategoryRelation = OneOrMany<CategoryRow>;
type ServiceWithCategory = ServiceRow & {
  service_categories: CategoryRelation;
};
type ServiceRelation = OneOrMany<ServiceWithCategory>;
type BranchServiceWithService = BranchServiceRow & { services: ServiceRelation };

type ServiceGroup = {
  categoryName: string;
  displayOrder: number;
  services: Array<
    BranchServiceRow & {
      service: ServiceWithCategory;
    }
  >;
};

function firstRelation<T>(relation: OneOrMany<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function formatCurrencyLocal(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function SelectServicePage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const [branchRaw, branchServicesRaw] = await Promise.all([
    getBranchById(branchId),
    getBranchServices(branchId),
  ]);

  const branch = branchRaw as BranchRow | null;
  const branchServices = branchServicesRaw as BranchServiceWithService[];

  if (!branch || !branch.is_active) {
    notFound();
  }

  const groupMap = new Map<string, ServiceGroup>();
  branchServices.forEach((branchService) => {
    const service = firstRelation(branchService.services);
    if (!service) return;

    const category = firstRelation(service.service_categories);
    const categoryId = category?.id ?? "other";

    if (!groupMap.has(categoryId)) {
      groupMap.set(categoryId, {
        categoryName: category?.name ?? "Other",
        displayOrder: category?.display_order ?? 99,
        services: [],
      });
    }

    groupMap.get(categoryId)?.services.push({
      id: branchService.id,
      custom_price: branchService.custom_price,
      is_active: branchService.is_active,
      service,
    });
  });

  const sortedGroups = Array.from(groupMap.values()).sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div>
      <BookingProgress currentStep={2} />

      <div style={{ marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href="/book"
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            textDecoration: "none",
          }}
        >
          ← Back
        </Link>
        <span style={{ color: "var(--cs-text-muted)" }}>·</span>
        <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>{branch.name}</span>
      </div>

      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--cs-text)",
          marginBottom: "0.375rem",
        }}
      >
        Choose a service
      </h2>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--cs-text-muted)",
          marginBottom: "1.5rem",
        }}
      >
        Select the treatment you&apos;d like to book
      </p>

      {sortedGroups.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          No services available at this location yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {sortedGroups.map((group) => (
            <div key={group.categoryName}>
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
                {group.categoryName}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {group.services.map((entry) => {
                  const price = entry.custom_price ?? entry.service.price;
                  return (
                    <Link
                      key={entry.service.id}
                      href={`/book/${branchId}/${entry.service.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        style={{
                          backgroundColor: "var(--cs-surface)",
                          border: "1.5px solid var(--cs-border)",
                          borderRadius: 10,
                          padding: "1rem 1.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--cs-text)" }}>
                            {entry.service.name}
                          </div>
                          {entry.service.description && (
                            <div
                              style={{
                                fontSize: "0.8125rem",
                                color: "var(--cs-text-muted)",
                                marginTop: 2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {entry.service.description}
                            </div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, textAlign: "right" }}>
                          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--cs-text)" }}>
                            {formatCurrencyLocal(Number(price))}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                            {entry.service.duration_minutes} min
                          </div>
                        </div>
                        <div style={{ color: "var(--cs-sand)", fontSize: 20, flexShrink: 0 }}>→</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
