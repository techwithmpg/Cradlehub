import { redirect } from "next/navigation";
import { getBranchesForOnboarding } from "./actions";
import { StaffOnboardingForm } from "./onboarding-form";

export const metadata = {
  title: "Staff Onboarding | Cradle Spa",
  description: "Complete your staff application for Cradle Massage & Wellness Spa",
};

export default async function StaffOnboardingPage() {
  if (process.env.STAFF_ONBOARDING_ENABLED !== "true") {
    redirect("/");
  }

  const branches = await getBranchesForOnboarding();

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--cs-bg)",
        fontFamily: "var(--font-dm-sans), sans-serif",
        padding: "2rem 1rem 4rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto 2rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🌿</div>
        <h1
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: "clamp(1.5rem, 5vw, 2rem)",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: "0.5rem",
          }}
        >
          Cradle Massage &amp; Wellness Spa
        </h1>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--cs-text-muted)",
            lineHeight: 1.6,
          }}
        >
          Complete your staff application below. Your account will be reviewed
          by a manager before access is activated.
        </p>
      </div>

      {/* Form card */}
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <StaffOnboardingForm branches={branches} />
      </div>

      {/* Footer */}
      <div
        style={{
          maxWidth: 520,
          margin: "2rem auto 0",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
        }}
      >
        Already have an account?{" "}
        <a href="/login" style={{ color: "var(--cs-sand)", textDecoration: "none" }}>
          Sign in
        </a>
      </div>
    </div>
  );
}
