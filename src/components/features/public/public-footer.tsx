import Link from "next/link";

const SERVICES_LIST = [
  "Swedish Massage",
  "Deep Tissue Massage",
  "Hot Stone Therapy",
  "Foot Reflexology",
  "Facial & Skincare",
  "Nail Care",
];

export function PublicFooter() {
  return (
    <footer
      style={{
        background: "var(--pw-forest-deep)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "56px 28px 28px",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Main grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "2rem",
            marginBottom: "3rem",
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: 18,
                fontWeight: 300,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--pw-gold)",
                marginBottom: 8,
              }}
            >
              Cradle
            </div>
            <div
              style={{
                fontSize: 9.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
                marginBottom: 14,
              }}
            >
              Wellness Living
            </div>
            <p
              style={{
                fontSize: 12.5,
                color: "rgba(247,243,237,0.4)",
                lineHeight: 1.7,
              }}
            >
              Premium spa and wellness in Bacolod City, Negros Occidental.
            </p>
          </div>

          {/* Treatments */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
                marginBottom: 16,
              }}
            >
              Treatments
            </div>
            {SERVICES_LIST.map((s) => (
              <div key={s} style={{ marginBottom: 8 }}>
                <Link
                  href="/services"
                  style={{
                    fontSize: 12.5,
                    color: "rgba(247,243,237,0.45)",
                    textDecoration: "none",
                  }}
                >
                  {s}
                </Link>
              </div>
            ))}
          </div>

          {/* Pages */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
                marginBottom: 16,
              }}
            >
              Pages
            </div>
            {[
              { href: "/book", label: "Book a Session" },
              { href: "/services", label: "Our Treatments" },
              { href: "/about", label: "About Cradle" },
              { href: "/products", label: "Gifts & Products" },
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <div key={link.href} style={{ marginBottom: 8 }}>
                <Link
                  href={link.href}
                  style={{
                    fontSize: 12.5,
                    color: "rgba(247,243,237,0.45)",
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
                marginBottom: 16,
              }}
            >
              Visit Us
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "rgba(247,243,237,0.45)",
                lineHeight: 1.8,
              }}
            >
              <div>Main Branch</div>
              <div>Bacolod City</div>
              <div style={{ marginTop: 10 }}>SM Branch</div>
              <div>SM City Bacolod</div>
              <div style={{ marginTop: 10 }}>
                <Link
                  href="/contact"
                  style={{
                    color: "var(--pw-gold)",
                    textDecoration: "none",
                    fontSize: 12,
                  }}
                >
                  Contact &amp; Locations →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              color: "rgba(247,243,237,0.3)",
            }}
          >
            © {new Date().getFullYear()} Cradle Wellness Living Inc. All rights reserved.
          </div>
          <Link
            href="/login"
            style={{
              fontSize: 11,
              color: "rgba(247,243,237,0.25)",
              textDecoration: "none",
            }}
          >
            Staff portal
          </Link>
        </div>
      </div>
    </footer>
  );
}
