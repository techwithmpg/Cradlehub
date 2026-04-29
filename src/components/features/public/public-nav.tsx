import Link from "next/link";

const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/branches", label: "Locations" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function PublicNav() {
  return (
    <header
      style={{
        backgroundColor: "var(--ch-surface)",
        borderBottom: "1px solid var(--ch-border)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 1.5rem",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <Link
          href="/"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              backgroundColor: "var(--ch-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "var(--ch-surface)", fontSize: 16, fontWeight: 700 }}>C</span>
          </div>
          <div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--ch-text)", lineHeight: 1 }}>
              Cradle Spa
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--ch-text-muted)",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              Massage &amp; Wellness
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex" style={{ gap: "1.5rem" }}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "0.875rem",
                color: "var(--ch-text-muted)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/book"
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            backgroundColor: "var(--ch-accent)",
            color: "var(--ch-surface)",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Book Now
        </Link>
      </div>

      <div
        className="flex md:hidden"
        style={{
          borderTop: "1px solid var(--ch-border)",
          padding: "0.5rem 1.5rem",
          gap: "1.25rem",
          overflowX: "auto",
        }}
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontSize: "0.8125rem",
              color: "var(--ch-text-muted)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              paddingBottom: "0.25rem",
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
