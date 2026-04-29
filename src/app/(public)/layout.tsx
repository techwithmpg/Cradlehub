import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "Book an Appointment | Cradle Spa",
    template: "%s | Cradle Spa",
  },
  description: "Book your spa appointment online at Cradle Massage & Wellness Spa, Bacolod City.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--ch-page-bg)" }}>
      <header
        style={{
          backgroundColor: "var(--ch-surface)",
          borderBottom: "1px solid var(--ch-border)",
          padding: "0 1.5rem",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
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
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--ch-text)" }}>
              Cradle Spa
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--ch-text-muted)" }}>Bacolod City</div>
          </div>
        </Link>

        <Link
          href="/login"
          style={{
            fontSize: "0.8125rem",
            color: "var(--ch-text-muted)",
            textDecoration: "none",
          }}
        >
          Staff login
        </Link>
      </header>

      <main
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "1.5rem 1rem 4rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
