import Link from "next/link";
import { PublicFooter } from "@/components/features/public/public-footer";
import { PublicNav } from "@/components/features/public/public-nav";
import { BranchCard } from "@/components/features/public/branch-card";
import { ServiceCard } from "@/components/features/public/service-card";
import { getAllBranches } from "@/lib/queries/branches";
import { getAllCategories, getAllServices } from "@/lib/queries/services";
import type { Tables } from "@/types/supabase";

type Branch = Tables<"branches">;
type Category = Tables<"service_categories">;
type ServiceListItem = Tables<"services"> & {
  service_categories?: Pick<Tables<"service_categories">, "id" | "name" | "display_order"> | null;
};

export default async function HomePage() {
  const [branchesResult, servicesResult, categoriesResult] = await Promise.all([
    getAllBranches(),
    getAllServices(),
    getAllCategories(),
  ]);

  const branches = branchesResult as Branch[];
  const services = servicesResult as ServiceListItem[];
  const categories = categoriesResult as Category[];
  const featuredServices = services.slice(0, 6);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--ch-page-bg)" }}>
      <PublicNav />

      <section
        style={{
          background: "linear-gradient(135deg, var(--ch-sidebar-bg) 0%, var(--ch-sidebar-border) 100%)",
          padding: "5rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: 20,
              backgroundColor: "var(--ch-sidebar-active-bg)",
              border: "1px solid var(--ch-border)",
              fontSize: "0.8125rem",
              color: "var(--ch-sidebar-text)",
              fontWeight: 500,
              marginBottom: "1.25rem",
              letterSpacing: "0.04em",
            }}
          >
            Bacolod City, Negros Occidental
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 700,
              color: "var(--ch-sidebar-active)",
              lineHeight: 1.15,
              marginBottom: "1rem",
            }}
          >
            Your sanctuary for rest and renewal
          </h1>

          <p
            style={{
              fontSize: "1.0625rem",
              color: "var(--ch-sidebar-text)",
              lineHeight: 1.65,
              maxWidth: 520,
              margin: "0 auto 2rem",
            }}
          >
            Premium massage and wellness treatments. Book your appointment online in minutes with
            instant confirmation.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/book"
              style={{
                padding: "14px 32px",
                borderRadius: 10,
                backgroundColor: "var(--ch-accent)",
                color: "var(--ch-surface)",
                fontSize: "1rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Book Now
            </Link>
            <Link
              href="/services"
              style={{
                padding: "14px 32px",
                borderRadius: 10,
                border: "1px solid var(--ch-sidebar-text)",
                color: "var(--ch-sidebar-active)",
                fontSize: "1rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              View Services
            </Link>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        <section style={{ padding: "4rem 0 3rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {[
              {
                title: "Expert Therapists",
                desc: "Senior, mid, and junior therapists trained to professional standards.",
              },
              {
                title: "Instant Booking",
                desc: "Book online in four steps. Your appointment is confirmed right away.",
              },
              {
                title: "Home Service",
                desc: "Prefer to stay in? We can bring your treatment to your location.",
              },
              {
                title: "Personalized Care",
                desc: "We track your preferences so each visit can feel even better.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                style={{
                  padding: "1.25rem",
                  backgroundColor: "var(--ch-surface)",
                  border: "1px solid var(--ch-border)",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--ch-text)",
                    marginBottom: "0.375rem",
                  }}
                >
                  {feature.title}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)", lineHeight: 1.6 }}>
                  {feature.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {featuredServices.length > 0 && (
          <section style={{ padding: "2rem 0 3rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--ch-text)", margin: 0 }}>
                  Our Treatments
                </h2>
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    fontSize: "0.8125rem",
                    color: "var(--ch-text-muted)",
                  }}
                >
                  {services.length} services across {categories.length} categories
                </p>
              </div>
              <Link
                href="/services"
                style={{
                  fontSize: "0.875rem",
                  color: "var(--ch-accent)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                View all services
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "0.875rem",
              }}
            >
              {featuredServices.map((service) => (
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
          </section>
        )}

        {branches.length > 0 && (
          <section style={{ padding: "2rem 0 3rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--ch-text)", margin: 0 }}>
                Our Locations
              </h2>
              <Link
                href="/branches"
                style={{
                  fontSize: "0.875rem",
                  color: "var(--ch-accent)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                View all locations
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1rem",
              }}
            >
              {branches.map((branch) => (
                <BranchCard
                  key={branch.id}
                  id={branch.id}
                  name={branch.name}
                  address={branch.address}
                  phone={branch.phone}
                  messengerLink={branch.messenger_link}
                  mapsEmbedUrl={branch.maps_embed_url}
                />
              ))}
            </div>
          </section>
        )}

        <section
          style={{
            padding: "3rem 2rem",
            marginBottom: "2rem",
            backgroundColor: "var(--ch-sidebar-bg)",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--ch-sidebar-active)",
              marginBottom: "0.625rem",
            }}
          >
            Ready to relax?
          </h2>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--ch-sidebar-text)",
              marginBottom: "1.5rem",
            }}
          >
            Book your appointment in under two minutes with instant confirmation.
          </p>
          <Link
            href="/book"
            style={{
              padding: "13px 36px",
              borderRadius: 10,
              backgroundColor: "var(--ch-accent)",
              color: "var(--ch-surface)",
              fontSize: "1rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Book an Appointment
          </Link>
        </section>
      </div>

      <PublicFooter />
    </div>
  );
}
