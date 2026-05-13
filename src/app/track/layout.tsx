import type { Metadata } from "next";
import { BUSINESS_NAME } from "@/lib/seo/constants";

export const metadata: Metadata = {
  title: `Tracking your visit | ${BUSINESS_NAME}`,
  description: "Track your Cradle home-service therapist in real time.",
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F7F3EB",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Minimal brand strip */}
      <header
        style={{
          width: "100%",
          background: "#10261D",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--sp-font-display, Georgia, serif)",
            fontSize: "1rem",
            fontWeight: 600,
            color: "#C8A96B",
            letterSpacing: "0.05em",
          }}
        >
          {BUSINESS_NAME}
        </span>
      </header>

      <main
        style={{
          width: "100%",
          maxWidth: 480,
          padding: "1.25rem 1rem 2rem",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
