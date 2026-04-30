"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isHome = pathname === "/";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: isHome
          ? "rgba(25,43,25,0.95)"
          : "rgba(247,243,237,0.96)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${isHome
          ? "rgba(255,255,255,0.06)"
          : "var(--pw-border-light)"}`,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 28px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--pw-radius)",
              background: "linear-gradient(135deg, var(--pw-forest), var(--pw-sage))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: "var(--pw-gold)",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "var(--pw-font-display)",
                letterSpacing: "0.1em",
              }}
            >
              C
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: 16,
                fontWeight: 400,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: isHome ? "var(--pw-cream)" : "var(--pw-ink)",
                lineHeight: 1,
              }}
            >
              Cradle
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: isHome
                  ? "rgba(201,169,110,0.7)"
                  : "var(--pw-warm-light)",
                marginTop: 3,
              }}
            >
              Wellness Living
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex" style={{ alignItems: "center", gap: 6 }}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                color: isHome
                  ? "rgba(247,243,237,0.65)"
                  : "var(--pw-warm)",
                borderBottom: pathname === link.href
                  ? "1px solid var(--pw-gold)"
                  : "1px solid transparent",
                transition: "color var(--pw-duration) var(--pw-ease)",
              }}
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/book"
            style={{
              marginLeft: 16,
              padding: "10px 22px",
              background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
              color: "var(--pw-forest-deep)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "var(--pw-radius)",
              boxShadow: "0 2px 12px rgba(201,169,110,0.35)",
              transition: "opacity var(--pw-duration)",
            }}
          >
            Book Now
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          className="md:hidden"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isHome ? "var(--pw-cream)" : "var(--pw-ink)"} strokeWidth="2">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden"
          style={{
            borderTop: `1px solid ${isHome ? "rgba(255,255,255,0.1)" : "var(--pw-border-light)"}`,
            padding: "12px 28px 20px",
            backgroundColor: isHome ? "var(--pw-forest-deep)" : "var(--pw-cream)",
          }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "10px 0",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                color: isHome ? "rgba(247,243,237,0.8)" : "var(--pw-warm)",
                borderBottom: `1px solid ${isHome ? "rgba(255,255,255,0.06)" : "var(--pw-border-light)"}`,
              }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/book"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              marginTop: 12,
              padding: "12px 0",
              background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
              color: "var(--pw-forest-deep)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "var(--pw-radius)",
              textAlign: "center",
            }}
          >
            Book Now
          </Link>
        </div>
      )}
    </header>
  );
}
