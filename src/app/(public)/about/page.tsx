import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <div style={{ padding: "2.5rem 0 4rem", maxWidth: 680, margin: "0 auto" }}>
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
          marginBottom: "2rem",
        }}
      >
        About Cradle Spa
      </h1>

      <div
        style={{
          fontSize: "1rem",
          color: "var(--ch-text-muted)",
          lineHeight: 1.8,
          marginBottom: "2.5rem",
        }}
      >
        <p style={{ marginBottom: "1rem" }}>
          Cradle Massage and Wellness Spa was founded on a simple belief: everyone deserves a place
          to truly rest. In Bacolod City, we built a calm sanctuary where skilled therapists,
          thoughtful care, and a welcoming environment work together.
        </p>
        <p style={{ marginBottom: "1rem" }}>
          Our team listens closely and adjusts each session to what your body needs, whether you want
          deeper relief, gentle relaxation, or something in between.
        </p>
        <p>
          From our first branch to today, our commitment stays the same: make every guest feel
          supported, restored, and genuinely cared for.
        </p>
      </div>

      <div style={{ marginBottom: "2.5rem" }}>
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "var(--ch-text)",
            marginBottom: "1.25rem",
          }}
        >
          Our Values
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {[
            {
              title: "Genuine Care",
              desc: "We treat every guest as a person, not a booking. Comfort and wellbeing come first.",
            },
            {
              title: "Skilled Hands",
              desc: "Therapists are continuously trained across senior, mid, and junior tiers.",
            },
            {
              title: "A Space to Breathe",
              desc: "Our environment is designed to help you slow down, reset, and recharge.",
            },
            {
              title: "Trusted by Families",
              desc: "Many guests return for years, and we are honored to be part of their routine.",
            },
          ].map((value) => (
            <div
              key={value.title}
              style={{
                display: "flex",
                gap: "0.875rem",
                padding: "1rem",
                backgroundColor: "var(--ch-surface)",
                border: "1px solid var(--ch-border)",
                borderRadius: 10,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--ch-text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {value.title}
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--ch-text-muted)", lineHeight: 1.6 }}>
                  {value.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
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
          Book Your First Visit
        </Link>
      </div>
    </div>
  );
}
