import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getAllCategories, getAllServices } from "@/lib/queries/services";
import { formatCurrency } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type CategoryRow = Database["public"]["Tables"]["service_categories"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export default async function ServicesPage() {
  const [categories, services] = await Promise.all([getAllCategories(), getAllServices()]);
  const typedCategories = categories as CategoryRow[];
  const typedServices = services as ServiceRow[];

  const grouped = typedCategories.map((category) => ({
    category,
    services: typedServices.filter((service) => service.category_id === category.id),
  }));

  return (
    <div>
      <PageHeader
        title="Services"
        description={`${typedServices.length} services across ${typedCategories.length} categories`}
        action={
          <Button
            asChild
            size="sm"
            style={{
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
            }}
          >
            <Link href="/owner/services/new">+ New Service</Link>
          </Button>
        }
      />

      {typedServices.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Create your first service category and service."
          action={
            <Button
              asChild
              style={{
                backgroundColor: "var(--cs-sand)",
                color: "#fff",
                border: "none",
              }}
            >
              <Link href="/owner/services/new">Create Service</Link>
            </Button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {grouped.map(({ category, services: categoryServices }) =>
            categoryServices.length === 0 ? null : (
              <div key={category.id}>
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
                  {category.name}
                </div>
                <div
                  style={{
                    backgroundColor: "var(--cs-surface)",
                    border: "1px solid var(--cs-border)",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {categoryServices.map((service, i) => (
                    <div
                      key={service.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "0.875rem 1rem",
                        borderBottom: i < categoryServices.length - 1 ? "1px solid var(--cs-border)" : "none",
                        opacity: service.is_active ? 1 : 0.5,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--cs-text)",
                          }}
                        >
                          {service.name}
                        </div>
                        {service.description && (
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
                            {service.description}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--cs-text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {service.duration_minutes} min
                      </div>
                      <div
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 600,
                          color: "var(--cs-text)",
                          flexShrink: 0,
                        }}
                      >
                        {formatCurrency(Number(service.price))}
                      </div>
                      {!service.is_active && (
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
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
