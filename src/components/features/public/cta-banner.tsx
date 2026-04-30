import Link from "next/link";

export type CtaBannerProps = {
  eyebrow?: string;
  heading: string;
  sub?: string;
  cta: string;
  ctaHref: string;
  cta2?: string;
  cta2Href?: string;
};

export function CtaBanner({
  eyebrow,
  heading,
  sub,
  cta,
  ctaHref,
  cta2,
  cta2Href,
}: CtaBannerProps) {
  return (
    <section
      style={{
        background: "var(--pw-forest-deep)",
        padding: "80px 28px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative circle */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(45,74,45,0.25)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
        {eyebrow && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(201,169,110,0.7)",
              marginBottom: 14,
            }}
          >
            {eyebrow}
          </div>
        )}

        <h2
          style={{
            fontFamily: "var(--pw-font-display)",
            fontSize: "clamp(28px, 5vw, 44px)",
            fontWeight: 300,
            color: "var(--pw-cream)",
            marginBottom: 14,
            lineHeight: 1.15,
          }}
        >
          {heading}
        </h2>

        {sub && (
          <p
            style={{
              fontSize: 14,
              color: "rgba(247,243,237,0.55)",
              lineHeight: 1.7,
              marginBottom: 28,
              maxWidth: 360,
              margin: "0 auto 28px",
            }}
          >
            {sub}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={ctaHref}
            style={{
              padding: "14px 36px",
              background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
              color: "var(--pw-forest-deep)",
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "var(--pw-radius)",
              boxShadow: "0 4px 20px rgba(201,169,110,0.4)",
            }}
          >
            {cta}
          </Link>
          {cta2 && cta2Href && (
            <Link
              href={cta2Href}
              style={{
                padding: "13px 30px",
                background: "transparent",
                color: "rgba(247,243,237,0.75)",
                fontSize: 11.5,
                fontWeight: 500,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                textDecoration: "none",
                borderRadius: "var(--pw-radius)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              {cta2}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
