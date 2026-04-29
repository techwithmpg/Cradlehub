import Link from "next/link";

export function PublicFooter() {
  return (
    <footer
      style={{
        backgroundColor: "var(--ch-sidebar-bg)",
        borderTop: "1px solid var(--ch-sidebar-border)",
        padding: "2.5rem 1.5rem",
        marginTop: "4rem",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "2rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "var(--ch-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>C</span>
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--ch-sidebar-active)" }}>
              Cradle Spa
            </div>
          </div>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--ch-sidebar-text)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Premium massage and wellness services in Bacolod City, Negros Occidental.
          </p>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--ch-text-subtle)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
            }}
          >
            Services
          </div>
          {["Swedish Massage", "Deep Tissue", "Hot Stone Therapy", "Reflexology", "Facials"].map((service) => (
            <div key={service} style={{ fontSize: "0.8125rem", color: "var(--ch-sidebar-text)", marginBottom: "0.375rem" }}>
              {service}
            </div>
          ))}
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--ch-text-subtle)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
            }}
          >
            Quick Links
          </div>
          {[
            { href: "/book", label: "Book Appointment" },
            { href: "/services", label: "Our Services" },
            { href: "/branches", label: "Locations" },
            { href: "/about", label: "About Us" },
            { href: "/contact", label: "Contact" },
          ].map((link) => (
            <div key={link.href} style={{ marginBottom: "0.375rem" }}>
              <Link
                href={link.href}
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--ch-sidebar-text)",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
            </div>
          ))}
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--ch-text-subtle)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
            }}
          >
            Connect
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--ch-sidebar-text)", lineHeight: 1.8 }}>
            <div>Bacolod City</div>
            <div>Negros Occidental</div>
            <div style={{ marginTop: "0.5rem" }}>
              <Link href="/contact" style={{ color: "var(--ch-accent)", textDecoration: "none" }}>
                Message us on Facebook →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1100,
          margin: "2rem auto 0",
          paddingTop: "1.25rem",
          borderTop: "1px solid var(--ch-sidebar-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "var(--ch-text-subtle)" }}>
          © {new Date().getFullYear()} Cradle Massage &amp; Wellness Spa. All rights reserved.
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--ch-text-subtle)" }}>
          <Link href="/login" style={{ color: "var(--ch-text-subtle)", textDecoration: "none" }}>
            Staff portal
          </Link>
        </div>
      </div>
    </footer>
  );
}
