import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";

const COMING_SOON_MODULES = [
  {
    icon: "🚗",
    label: "Assigned Home Service Trips",
    desc: "View all home service bookings assigned to you with pickup details",
  },
  {
    icon: "📍",
    label: "Customer Location",
    desc: "Delivery addresses and contact info for each trip",
  },
  {
    icon: "👩‍💼",
    label: "Therapist Assignment",
    desc: "See which therapist you are transporting for each appointment",
  },
  {
    icon: "⏱️",
    label: "Travel Buffer",
    desc: "Built-in buffer time to ensure on-time arrival",
  },
  {
    icon: "🗺️",
    label: "Open in Maps",
    desc: "Launch navigation to the customer location",
  },
  {
    icon: "✅",
    label: "Trip Status",
    desc: "Mark trips as picked up, in transit, or completed",
  },
];

async function requireDriverAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role, staff_type")
    .eq("auth_user_id", user.id)
    .single();

  // Owner can access everything; driver staff_type required otherwise
  if (me?.system_role === "owner") return;
  if (me?.staff_type !== "driver") redirect("/staff-portal");
}

export default async function DriverPanelPage() {
  await requireDriverAccess();

  return (
    <div>
      <PageHeader
        title="Driver Panel"
        description="Home service dispatch, assigned trips, therapist pickup coordination, and route support will appear here."
        icon="🚗"
      />

      <div
        style={{
          backgroundColor: "var(--cs-surface-warm)",
          border: "1px solid var(--cs-border-light)",
          borderRadius: "var(--cs-radius-lg)",
          padding: "2rem",
          textAlign: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🚗</div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: "0.25rem",
          }}
        >
          Coming Soon
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", maxWidth: 480, margin: "0 auto" }}>
          Driver dispatch and home service trip management are being built.
          Check back soon.
        </p>
      </div>

      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.75rem",
        }}
      >
        Planned Modules
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {COMING_SOON_MODULES.map((m) => (
          <div
            key={m.label}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "1rem",
              borderRadius: "var(--cs-radius-lg)",
              backgroundColor: "var(--cs-surface-warm)",
              border: "1px solid var(--cs-border-light)",
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, filter: "grayscale(0.6)" }}>{m.icon}</span>
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  marginBottom: 2,
                }}
              >
                {m.label}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
                {m.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link
          href="/staff-portal"
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          &larr; Back to Staff Portal
        </Link>
      </div>
    </div>
  );
}
