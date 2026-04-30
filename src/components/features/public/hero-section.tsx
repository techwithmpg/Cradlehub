import Link from "next/link";

export function HeroSection() {
  return (
    <section
      style={{
        background: "var(--pw-forest-deep)",
        padding: "96px 28px 0",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Botanical pattern overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(45,74,45,0.5) 0%, transparent 65%), " +
            "repeating-linear-gradient(45deg, transparent, transparent 80px, rgba(255,255,255,0.008) 80px, rgba(255,255,255,0.008) 81px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 620, margin: "0 auto", position: "relative" }}>
        {/* Location pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            border: "1px solid rgba(201,169,110,0.25)",
            borderRadius: 100,
            marginBottom: 28,
            background: "rgba(201,169,110,0.06)",
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--pw-gold)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "rgba(201,169,110,0.8)",
            }}
          >
            Bacolod City · Negros Occidental
          </span>
        </div>

        {/* Main headline */}
        <h1
          style={{
            fontFamily: "var(--pw-font-display)",
            fontWeight: 300,
            fontSize: "clamp(44px, 9vw, 76px)",
            lineHeight: 1.06,
            letterSpacing: "0.01em",
            color: "var(--pw-cream)",
            marginBottom: 20,
          }}
        >
          Where Stillness
          <br />
          Meets{" "}
          <em style={{ fontStyle: "italic", color: "var(--pw-gold)" }}>Renewal</em>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.75,
            color: "rgba(247,243,237,0.65)",
            maxWidth: 420,
            margin: "0 auto 36px",
          }}
        >
          Premium massage and wellness treatments crafted for your complete restoration.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/book"
            style={{
              padding: "15px 36px",
              background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
              color: "var(--pw-forest-deep)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "var(--pw-radius)",
              boxShadow: "0 4px 20px rgba(201,169,110,0.4)",
            }}
          >
            Reserve a Session
          </Link>
          <Link
            href="/services"
            style={{
              padding: "14px 32px",
              background: "transparent",
              color: "rgba(247,243,237,0.8)",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "var(--pw-radius)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            Our Treatments
          </Link>
        </div>
      </div>

      {/* Trust bar */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "28px 28px",
          marginTop: 72,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          {[
            { n: "4.9", l: "Guest Rating" },
            { n: "2,000+", l: "Sessions Monthly" },
            { n: "2", l: "Locations" },
          ].map((item, i) => (
            <div
              key={item.l}
              style={{
                textAlign: "center",
                padding: "0 16px",
                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--pw-font-display)",
                  fontSize: 30,
                  fontWeight: 300,
                  color: "var(--pw-gold)",
                  lineHeight: 1,
                }}
              >
                {item.n}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 5,
                }}
              >
                {item.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
