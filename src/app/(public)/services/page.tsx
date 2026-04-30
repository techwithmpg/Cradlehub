import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCard } from "@/components/features/public/service-card";
import { CtaBanner } from "@/components/features/public/cta-banner";
import { getAllCategories, getAllServices } from "@/lib/queries/services";

export const metadata: Metadata = { title: "Treatments & Services" };

export default async function ServicesPage() {
  const [categories, services] = await Promise.all([
    getAllCategories(),
    getAllServices(),
  ]);

  const grouped = categories
    .map((cat) => ({
      category: cat,
      services: services.filter((s) => s.category_id === cat.id),
    }))
    .filter((group) => group.services.length > 0);

  return (
    <>
      {/* Page hero */}
      <section
        style={{
          background: "var(--pw-forest-deep)",
          padding: "72px 28px 56px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(201,169,110,0.7)",
              marginBottom: 16,
            }}
          >
            Our Treatments
          </div>
          <h1
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: "clamp(36px, 7vw, 56px)",
              fontWeight: 300,
              color: "var(--pw-cream)",
              lineHeight: 1.08,
              marginBottom: 16,
            }}
          >
            Curated for Renewal
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "rgba(247,243,237,0.6)",
              lineHeight: 1.7,
              maxWidth: 400,
              margin: "0 auto",
            }}
          >
            Every treatment crafted to restore your body, calm your mind, and renew your spirit.
          </p>
        </div>
      </section>

      {/* Services by category */}
      <section
        style={{ padding: "var(--pw-section) 28px", background: "var(--pw-cream)" }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {grouped.map(({ category, services: catServices }) => (
            <div key={category.id} style={{ marginBottom: 56 }}>
              {/* Category header */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--pw-gold)",
                    marginBottom: 8,
                  }}
                >
                  {category.name}
                </div>
                <div
                  style={{
                    width: 40,
                    height: 1,
                    background: "var(--pw-border)",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                {catServices.map((svc) => (
                  <ServiceCard
                    key={svc.id}
                    category={category.name}
                    name={svc.name}
                    description={svc.description}
                    durationMinutes={svc.duration_minutes}
                    price={Number(svc.price)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Salon pricing note */}
          <div
            style={{
              padding: "20px 24px",
              background: "var(--pw-mist)",
              borderRadius: "var(--pw-radius-lg)",
              border: "1px solid var(--pw-moss)",
            }}
          >
            <p
              style={{
                fontSize: 13.5,
                color: "var(--pw-warm)",
                lineHeight: 1.65,
              }}
            >
              Salon service pricing (Nail Care, Facial &amp; Skincare, Hair &amp; Salon) is currently being finalised. Contact us for current rates and availability.{" "}
              <Link
                href="/contact"
                style={{ color: "var(--pw-sage)", textDecoration: "none" }}
              >
                Get in touch →
              </Link>
            </p>
          </div>
        </div>
      </section>

      <CtaBanner
        heading="Ready to experience it?"
        sub="Book your session online in under 2 minutes. Confirmed instantly."
        cta="Book Now"
        ctaHref="/book"
      />
    </>
  );
}
