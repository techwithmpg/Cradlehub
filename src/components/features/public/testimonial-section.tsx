const TESTIMONIALS = [
  {
    text: "The Swedish massage was everything I needed. The therapists are incredibly skilled — I left feeling completely renewed. Already booked my next session.",
    name: "Maria C.",
    branch: "Main Branch",
    rating: 5,
  },
  {
    text: "Hot Stone Ritual was transformative. The ambiance, the care, the technique — everything speaks to a different level of quality. This is my sanctuary now.",
    name: "James R.",
    branch: "SM Branch",
    rating: 5,
  },
  {
    text: "The home service option is a game-changer for a busy professional. Same premium experience, at my home. Cradle truly goes above and beyond.",
    name: "Dr. Ana P.",
    branch: "Home Service",
    rating: 5,
  },
];

export function TestimonialSection() {
  return (
    <section
      style={{
        padding: "var(--pw-section) 28px",
        background: "var(--pw-white)",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
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
            Guest Experiences
          </div>
          <h2
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 300,
              color: "var(--pw-ink)",
            }}
          >
            What our guests say
          </h2>
        </div>

        {/* Testimonial grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0",
            border: "1px solid var(--pw-border-light)",
            borderRadius: "var(--pw-radius-lg)",
            overflow: "hidden",
          }}
        >
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              style={{
                padding: "36px 32px",
                borderRight:
                  i < TESTIMONIALS.length - 1
                    ? "1px solid var(--pw-border-light)"
                    : "none",
                position: "relative",
              }}
            >
              {/* Large quote mark */}
              <div
                style={{
                  fontFamily: "var(--pw-font-display)",
                  fontSize: 72,
                  fontWeight: 300,
                  color: "var(--pw-gold)",
                  opacity: 0.18,
                  lineHeight: 0.8,
                  marginBottom: 8,
                }}
              >
                &ldquo;
              </div>

              {/* Stars */}
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  marginBottom: 16,
                }}
              >
                {Array.from({ length: t.rating }).map((_, si) => (
                  <div
                    key={si}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "var(--pw-gold)",
                    }}
                  />
                ))}
              </div>

              {/* Quote text */}
              <p
                style={{
                  fontFamily: "var(--pw-font-display)",
                  fontStyle: "italic",
                  fontSize: 17,
                  lineHeight: 1.7,
                  color: "var(--pw-ink)",
                  marginBottom: 20,
                }}
              >
                {t.text}
              </p>

              {/* Attribution */}
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--pw-warm)",
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--pw-sage)",
                    marginTop: 2,
                  }}
                >
                  {t.branch}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
