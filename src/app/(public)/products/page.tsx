import type { Metadata } from "next";
import Link from "next/link";
import { CtaBanner } from "@/components/features/public/cta-banner";

export const metadata: Metadata = { title: "Products & Gifts" };

const ADDONS = [
  { name: "Aromatherapy Upgrade", desc: "Add premium essential oil blends to any massage.", price: "₱150" },
  { name: "Hot Herbal Compress", desc: "Heated herbal pack to relieve tension and soothe muscles.", price: "₱200" },
  { name: "Extended Time (+30)", desc: "Add 30 minutes to any session for deeper treatment.", price: "₱300" },
  { name: "Premium Head Massage", desc: "Scalp and neck focus add-on for stress relief.", price: "₱180" },
  { name: "Warm Oil Foot Soak", desc: "Revitalising foot soak with herbal infusion before your session.", price: "₱120" },
  { name: "Double Therapist", desc: "Two therapists, simultaneous treatment. Maximum efficiency.", price: "+50%" },
];

const PACKAGES = [
  {
    name: "Restoration Duo",
    desc: "Swedish Massage 90min + Foot Reflexology 45min. Complete renewal in one visit.",
    price: "₱1,400",
    dur: "135 min combined",
    tag: "Best Value",
  },
  {
    name: "The Cradle Experience",
    desc: "Hot Stone 90min + Aromatherapy + Foot Reflexology. Our signature complete immersion.",
    price: "₱2,000",
    dur: "Full day ritual",
    tag: "Signature",
  },
];

export default function ProductsPage() {
  return (
    <>
      <section
        style={{
          background: "var(--pw-forest-deep)",
          padding: "72px 28px 56px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
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
            Gifts &amp; Add-ons
          </div>
          <h1
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: "clamp(32px, 6vw, 48px)",
              fontWeight: 300,
              color: "var(--pw-cream)",
              marginBottom: 14,
            }}
          >
            Enhance your experience
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(247,243,237,0.55)",
              lineHeight: 1.7,
            }}
          >
            Premium add-ons, gift cards, and curated wellness packages.
          </p>
        </div>
      </section>

      <section
        style={{
          padding: "var(--pw-section) 28px",
          background: "var(--pw-cream)",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* Add-ons */}
          <div style={{ marginBottom: 56 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--pw-gold)",
                marginBottom: 20,
              }}
            >
              Session Add-ons
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {ADDONS.map((a) => (
                <div
                  key={a.name}
                  style={{
                    background: "var(--pw-white)",
                    border: "1px solid var(--pw-border)",
                    borderRadius: "var(--pw-radius-lg)",
                    padding: "20px 20px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "var(--pw-font-display)",
                      fontSize: 18,
                      fontWeight: 400,
                      marginBottom: 8,
                      color: "var(--pw-ink)",
                    }}
                  >
                    {a.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--pw-warm)",
                      lineHeight: 1.6,
                      flex: 1,
                      marginBottom: 14,
                    }}
                  >
                    {a.desc}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 14,
                      borderTop: "1px solid var(--pw-border-light)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--pw-font-display)",
                        fontSize: 20,
                        fontWeight: 300,
                        color: "var(--pw-gold)",
                      }}
                    >
                      {a.price}
                    </span>
                    <Link
                      href="/book"
                      style={{
                        padding: "7px 14px",
                        border: "1px solid var(--pw-border)",
                        color: "var(--pw-warm)",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.09em",
                        textTransform: "uppercase",
                        textDecoration: "none",
                        borderRadius: "var(--pw-radius)",
                      }}
                    >
                      Add
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Packages */}
          <div style={{ marginBottom: 56 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--pw-gold)",
                marginBottom: 20,
              }}
            >
              Wellness Packages
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {PACKAGES.map((p) => (
                <div
                  key={p.name}
                  style={{
                    background: "var(--pw-white)",
                    border: "1.5px solid var(--pw-gold)",
                    borderRadius: "var(--pw-radius-lg)",
                    padding: "28px 24px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      padding: "3px 10px",
                      background: "var(--pw-gold-light)",
                      color: "#7A5A30",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      borderRadius: 100,
                    }}
                  >
                    {p.tag}
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--pw-font-display)",
                      fontSize: 22,
                      fontWeight: 400,
                      color: "var(--pw-ink)",
                      marginBottom: 10,
                    }}
                  >
                    {p.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "var(--pw-warm)",
                      lineHeight: 1.65,
                      marginBottom: 20,
                    }}
                  >
                    {p.desc}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      paddingTop: 18,
                      borderTop: "1px solid var(--pw-border-light)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--pw-font-display)",
                          fontSize: 26,
                          fontWeight: 300,
                          color: "var(--pw-ink)",
                          lineHeight: 1,
                        }}
                      >
                        {p.price}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--pw-warm-light)",
                          marginTop: 3,
                        }}
                      >
                        {p.dur}
                      </div>
                    </div>
                    <Link
                      href="/book"
                      style={{
                        padding: "10px 20px",
                        background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
                        color: "var(--pw-forest-deep)",
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        textDecoration: "none",
                        borderRadius: "var(--pw-radius)",
                      }}
                    >
                      Reserve
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gift cards */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--pw-gold)",
                marginBottom: 20,
              }}
            >
              Gift Cards
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              {[
                { amount: "₱500", label: "Single Session Gift", sub: "For the person who deserves rest" },
                { amount: "₱1,000", label: "Couples Gift Card", sub: "Two people, one shared experience" },
                { amount: "₱1,800", label: "Premium Gift Card", sub: "Two full sessions, unlimited wellness" },
                { amount: "Custom", label: "Custom Amount", sub: "Choose any amount from ₱300 upward" },
              ].map((g) => (
                <div
                  key={g.amount}
                  style={{
                    background: "linear-gradient(135deg, var(--pw-forest-deep), var(--pw-forest))",
                    borderRadius: "var(--pw-radius-lg)",
                    padding: "24px 22px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      right: -12,
                      top: -12,
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      background: "rgba(201,169,110,0.1)",
                    }}
                  />
                  <div
                    style={{
                      fontFamily: "var(--pw-font-display)",
                      fontSize: 13,
                      fontWeight: 400,
                      color: "var(--pw-cream)",
                      marginBottom: 4,
                      position: "relative",
                    }}
                  >
                    {g.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "rgba(247,243,237,0.45)",
                      position: "relative",
                      marginBottom: 16,
                    }}
                  >
                    {g.sub}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--pw-font-display)",
                      fontSize: 28,
                      fontWeight: 300,
                      color: "var(--pw-gold)",
                      position: "relative",
                      marginBottom: 16,
                    }}
                  >
                    {g.amount}
                  </div>
                  <button
                    style={{
                      padding: "9px 18px",
                      background: "rgba(201,169,110,0.15)",
                      border: "1px solid rgba(201,169,110,0.3)",
                      color: "var(--pw-gold)",
                      fontSize: 10.5,
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      borderRadius: "var(--pw-radius)",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    Purchase
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaBanner
        heading="Give the gift of restoration"
        sub="Gift cards are available at both branch locations or via Messenger."
        cta="Book a Session"
        ctaHref="/book"
        cta2="Contact Us"
        cta2Href="/contact"
      />
    </>
  );
}
