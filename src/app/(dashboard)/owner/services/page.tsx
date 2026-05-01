import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { ServicesPageClient } from "@/components/features/services/services-page-client";
import { getAllCategories, getAllServicesForOwner } from "@/lib/queries/services";
import { Button } from "@/components/ui/button";

export default async function ServicesPage() {
  const [categories, services] = await Promise.all([
    getAllCategories(),
    getAllServicesForOwner(),
  ]);

  const activeCount = services.filter((s) => s.is_active).length;
  const inactiveCount = services.length - activeCount;

  return (
    <div>
      <PageHeader
        title="Services"
        description={`${services.length} services across ${categories.length} categories · ${activeCount} active · ${inactiveCount} inactive`}
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

      {services.length === 0 ? (
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
        <ServicesPageClient services={services as never} />
      )}
    </div>
  );
}
