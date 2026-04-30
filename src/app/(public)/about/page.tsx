import type { Metadata } from "next";
import { CtaBanner } from "@/components/features/public/cta-banner";

export const metadata: Metadata = { title: "About Cradle" };

const VALUES = [
  {
    title: "Genuine Care",
    desc: "Every guest is a person, not a booking. Your comfort and wellbeing are our highest priority.",
  },
  {
    title: "Skilled Hands",
    desc: "Our therapists are continuously trained. Senior, mid, and junior levels — all held to the same standard of excellence.",
  },
  {
    title: "A Space to Breathe",
    desc: "Everything about our environment is designed to help you let go — the atmosphere, the pace, the deliberate silence.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section
        style={{
          background: "var(--pw-forest-deep)",
          padding: "80px 28px 60px",
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
            Our Story
          </div>
          <h1
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: "clamp(36px, 7vw, 56px)",
              fontWeight: 300,
              color: "var(--pw-cream)",
              lineHeight: 1.08,
            }}
          >
            Born from a belief
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "rgba(247,243,237,0.55)",
              lineHeight: 1.75,
              marginTop: 16,
              maxWidth: 400,
              margin: "16px auto 0",
            }}
          >
            That every person deserves a sanctuary — a place to truly rest and restore.
          </p>
        </div>
      </section>

      {/* Story */}
      <section
        style={{ padding: "var(--pw-section) 28px", background: "var(--pw-cream)" }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <blockquote
            style={{
              fontFamily: "var(--pw-font-display)",
              fontStyle: "italic",
              fontSize: "clamp(20px, 4vw, 28px)",
              fontWeight: 300,
              lineHeight: 1.65,
              color: "var(--pw-forest)",
              textAlign: "center",
              marginBottom: 40,
            }}
          >
            True wellness is not a destination. It is a daily practice of returning
            to your most peaceful self.
          </blockquote>
          <p
            style={{
              fontSize: 15,
              color: "var(--pw-warm)",
              lineHeight: 1.85,
              marginBottom: 20,
            }}
          >
            Cradle Massage &amp; Wellness Spa was founded in Bacolod City with a single
            conviction: that skilled hands, thoughtful care, and a calm environment
            can transform a person&apos;s day — and life.
          </p>
          <p
            style={{
              fontSize: 15,
              color: "var(--pw-warm)",
              lineHeight: 1.85,
            }}
          >
            From our first branch to where we are today — two locations, fifty-one
            dedicated professionals — our commitment has never changed: to give every
            guest the feeling of being truly cared for.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section
        style={{
          background: "var(--pw-mist)",
          padding: "var(--pw-section-sm) 28px",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              border: "1px solid var(--pw-border)",
              borderRadius: "var(--pw-radius-lg)",
              overflow: "hidden",
              background: "var(--pw-white)",
            }}
          >
            {[
              { n: "51", l: "Expert Staff" },
              { n: "2", l: "Locations" },
              { n: "4.9", l: "Average Rating" },
            ].map((stat, i) => (
              <div
                key={stat.l}
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  borderRight: i < 2 ? "1px solid var(--pw-border)" : "none",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--pw-font-display)",
                    fontSize: 36,
                    fontWeight: 300,
                    color: "var(--pw-gold)",
                    lineHeight: 1,
                  }}
                >
                  {stat.n}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--pw-warm-light)",
                    marginTop: 6,
                  }}
                >
                  {stat.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
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
              Our Values
            </div>
            <h2
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: "clamp(24px, 4vw, 36px)",
                fontWeight: 300,
                color: "var(--pw-ink)",
              }}
            >
              What guides us
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {VALUES.map((v) => (
              <div
                key={v.title}
                style={{
                  background: "var(--pw-white)",
                  border: "1px solid var(--pw-border-light)",
                  borderRadius: "var(--pw-radius-lg)",
                  padding: "28px 24px",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--pw-mist)",
                    marginBottom: 16,
                  }}
                />
                <h3
                  style={{
                    fontFamily: "var(--pw-font-display)",
                    fontSize: 20,
                    fontWeight: 400,
                    color: "var(--pw-ink)",
                    marginBottom: 10,
                  }}
                >
                  {v.title}
                </h3>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--pw-warm)",
                    lineHeight: 1.65,
                  }}
                >
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        heading="Come experience it yourself"
        cta="Book Your First Visit"
        ctaHref="/book"
      />
    </>
  );
}
