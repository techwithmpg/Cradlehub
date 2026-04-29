import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCard } from "@/components/features/public/service-card";
import { getAllCategories, getAllServices } from "@/lib/queries/services";
import type { Tables } from "@/types/supabase";

type Category = Tables<"service_categories">;
type ServiceListItem = Tables<"services"> & {
  service_categories?: Pick<Tables<"service_categories">, "id" | "name" | "display_order"> | null;
};

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const [categoriesResult, servicesResult] = await Promise.all([getAllCategories(), getAllServices()]);
  const categories = categoriesResult as Category[];
  const services = servicesResult as ServiceListItem[];

  const grouped = categories
    .map((category) => ({
      category,
      services: services.filter((service) => service.category_id === category.id),
    }))
    .filter((group) => group.services.length > 0);

  return (
    <div style={{ padding: "2.5rem 0 4rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/" style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)", textDecoration: "none" }}>
          Back to home
        </Link>
      </div>

      <h1
        style={{
          fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
          fontWeight: 700,
          color: "var(--ch-text)",
          marginBottom: "0.5rem",
        }}
      >
        Our Services
      </h1>
      <p
        style={{
          fontSize: "1rem",
          color: "var(--ch-text-muted)",
          marginBottom: "2.5rem",
          lineHeight: 1.6,
        }}
      >
        From deep relaxation to targeted relief, choose the treatment that fits your needs.
      </p>

      {grouped.map(({ category, services: categoryServices }) => (
        <div key={category.id} style={{ marginBottom: "3rem" }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--ch-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "0.875rem",
            }}
          >
            {category.name}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "0.875rem",
            }}
          >
            {categoryServices.map((service) => (
              <ServiceCard
                key={service.id}
                id={service.id}
                name={service.name}
                description={service.description}
                durationMinutes={service.duration_minutes}
                price={Number(service.price)}
              />
            ))}
          </div>
        </div>
      ))}

      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          backgroundColor: "var(--ch-surface)",
          border: "1px solid var(--ch-border)",
          borderRadius: 12,
        }}
      >
        <p style={{ fontSize: "1rem", color: "var(--ch-text-muted)", marginBottom: "1rem" }}>
          Not sure which service to choose? Message us and we can help.
        </p>
        <Link
          href="/contact"
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "1px solid var(--ch-border)",
            color: "var(--ch-text-muted)",
            fontSize: "0.9375rem",
            textDecoration: "none",
            backgroundColor: "var(--ch-surface)",
          }}
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
