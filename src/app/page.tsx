import Link from "next/link";
import { HeroSection } from "@/components/features/public/hero-section";
import { ServiceCard } from "@/components/features/public/service-card";
import { BranchCard } from "@/components/features/public/branch-card";
import { TestimonialSection } from "@/components/features/public/testimonial-section";
import { CtaBanner } from "@/components/features/public/cta-banner";
import { PublicNav } from "@/components/features/public/public-nav";
import { PublicFooter } from "@/components/features/public/public-footer";
import { getAllBranches } from "@/lib/queries/branches";
import { getAllServices } from "@/lib/queries/services";
import { getAllCategories } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export default async function HomePage() {
  const [branches, services] = await Promise.all([
    getAllBranches(),
    getAllServices(),
    getAllCategories(),
  ]);

  const featured = services.slice(0, 3);
  const typedBranches = branches as BranchRow[];

  return (
    <div
      style={{
        fontFamily: "var(--pw-font-body)",
        backgroundColor: "var(--pw-cream)",
        color: "var(--pw-ink)",
      }}
    >
      <PublicNav />
      <main>
        {/* HERO */}
        <HeroSection />

        {/* FEATURED SERVICES */}
        <section
          style={{ padding: "var(--pw-section) 28px", background: "var(--pw-cream)" }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--pw-gold)",
                  marginBottom: 12,
                }}
              >
                Signature Treatments
              </div>
              <h2
                style={{
                  fontFamily: "var(--pw-font-display)",
                  fontSize: "clamp(28px, 5vw, 40px)",
                  fontWeight: 300,
                  color: "var(--pw-ink)",
                }}
              >
                Curated for renewal
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {featured.map((svc, i) => (
                <ServiceCard
                  key={svc.id}
                  category={
                    (svc as { service_categories?: { name: string } | null }).service_categories?.name ?? "Treatment"
                  }
                  name={svc.name}
                  description={svc.description}
                  durationMinutes={svc.duration_minutes}
                  price={Number(svc.price)}
                  featured={i === 1}
                />
              ))}
            </div>

            <div style={{ textAlign: "center" }}>
              <Link
                href="/services"
                style={{
                  padding: "11px 28px",
                  border: "1px solid var(--pw-border)",
                  color: "var(--pw-warm)",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  borderRadius: "var(--pw-radius)",
                }}
              >
                View All Treatments
              </Link>
            </div>
          </div>
        </section>

        {/* PHILOSOPHY STRIP */}
        <section
          style={{
            background: "var(--pw-mist)",
            padding: "var(--pw-section) 28px",
          }}
        >
          <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: 72,
                fontWeight: 300,
                color: "var(--pw-gold)",
                opacity: 0.2,
                lineHeight: 0.7,
                marginBottom: 8,
              }}
            >
              &ldquo;
            </div>
            <blockquote
              style={{
                fontFamily: "var(--pw-font-display)",
                fontStyle: "italic",
                fontSize: "clamp(20px, 4vw, 26px)",
                fontWeight: 300,
                lineHeight: 1.65,
                color: "var(--pw-forest)",
              }}
            >
              True wellness is not a luxury — it is a necessity. At Cradle, every session is a return to your most rested self.
            </blockquote>
            <div
              style={{
                marginTop: 20,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--pw-warm)",
              }}
            >
              Anna Liza F. Lacson, Founder
            </div>
            <div
              style={{
                width: 36,
                height: 1,
                background: "var(--pw-gold)",
                margin: "20px auto 0",
              }}
            />
          </div>
        </section>

        {/* TESTIMONIALS */}
        <TestimonialSection />

        {/* LOCATIONS */}
        <section
          style={{ padding: "var(--pw-section) 28px", background: "var(--pw-cream)" }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--pw-gold)",
                  marginBottom: 12,
                }}
              >
                Our Locations
              </div>
              <h2
                style={{
                  fontFamily: "var(--pw-font-display)",
                  fontSize: "clamp(28px, 5vw, 40px)",
                  fontWeight: 300,
                  color: "var(--pw-ink)",
                }}
              >
                Visit us in Bacolod
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {typedBranches.map((b) => (
                <BranchCard
                  key={b.id}
                  id={b.id}
                  name={b.name}
                  address={b.address ?? "Bacolod City"}
                  phone={b.phone}
                  email={b.email}
                  messengerLink={b.messenger_link}
                  mapsEmbedUrl={b.maps_embed_url}
                  badge={b.name.includes("SM") ? "SM City Bacolod" : "Flagship"}
                  hours="Daily · 9:00 AM – 9:00 PM"
                />
              ))}
            </div>

            {/* Home service strip */}
            <div
              style={{
                marginTop: 24,
                padding: "20px 28px",
                background: "var(--pw-gold-light)",
                borderRadius: "var(--pw-radius-lg)",
                border: "1px solid rgba(201,169,110,0.3)",
                display: "flex",
                alignItems: "center",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{
                    fontFamily: "var(--pw-font-display)",
                    fontSize: 18,
                    fontWeight: 400,
                    color: "var(--pw-forest-deep)",
                    marginBottom: 4,
                  }}
                >
                  Home Service Available
                </div>
                <p
                  style={{ fontSize: 13, color: "var(--pw-warm)", lineHeight: 1.6 }}
                >
                  Our therapists come to you — home, office, or hotel. Select home
                  service when booking online.
                </p>
              </div>
              <Link
                href="/book"
                style={{
                  padding: "11px 24px",
                  background: "var(--pw-forest-deep)",
                  color: "var(--pw-gold)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  borderRadius: "var(--pw-radius)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Book Home Service
              </Link>
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <CtaBanner
          eyebrow="Begin Your Journey"
          heading="Your restoration awaits"
          sub="Book instantly. Available for on-site, home service, and walk-in appointments. Confirmed in seconds."
          cta="Reserve a Session"
          ctaHref="/book"
          cta2="View Treatments"
          cta2Href="/services"
        />
      </main>
      <PublicFooter />
    </div>
  );
}
