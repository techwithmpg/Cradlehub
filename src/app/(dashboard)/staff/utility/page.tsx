import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { Sun, ClipboardList, QrCode, Bell, MoreHorizontal } from "lucide-react";

export function canAccessCanonicalUtility(
  role: string | null | undefined,
  staffType?: string | null | undefined
): boolean {
  return resolveStaffPwaOperationalGroup(role, staffType) === "utility";
}

async function requireCanonicalUtilityAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role, staff_type")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (canAccessCanonicalUtility(me?.system_role, me?.staff_type)) return;
  redirect("/staff");
}

export default async function CanonicalUtilityPage() {
  await requireCanonicalUtilityAccess();

  const destinations = [
    {
      label: "Work",
      href: "/staff/utility/work",
      icon: ClipboardList,
      desc: "View work status",
    },
    {
      label: "Scan",
      href: "/staff/scan",
      icon: QrCode,
      desc: "Attendance scanning",
    },
    {
      label: "Notices",
      href: "/staff/utility/notices",
      icon: Bell,
      desc: "Announcements & alerts",
    },
    {
      label: "More",
      href: "/staff/utility/more",
      icon: MoreHorizontal,
      desc: "Account & preferences",
    },
  ];

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)", paddingBottom: "5rem" }}>
      {/* Top Header */}
      <div
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid var(--cs-border-soft)",
          padding: "0.875rem 1rem",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--cs-staff-accent)" }}>
          CradleHub Staff
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--cs-text)", letterSpacing: "-0.01em" }}>
            Utility
          </h1>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text-muted)" }}>
            Team Workspace
          </span>
        </div>
      </div>

      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 480, margin: "0 auto" }}>
        {/* Status card */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            border: "1px solid var(--cs-border-soft)",
            padding: "1.125rem",
            boxShadow: "var(--cs-shadow-xs)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--cs-staff-accent)",
              }}
            >
              <Sun size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-text)" }}>Today</div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>Shared foundation active</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
            Welcome to your staff workspace. Use the quick actions below to check notices, scan attendance, or view work information.
          </p>
        </div>

        {/* Foundation Destinations Grid */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--cs-text-muted)",
              marginBottom: "0.5rem",
            }}
          >
            Workplace Navigation
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.625rem",
            }}
          >
            {destinations.map(({ label, href, icon: Icon, desc }) => (
              <Link
                key={href}
                href={href}
                style={{
                  textDecoration: "none",
                  backgroundColor: "#fff",
                  borderRadius: 14,
                  border: "1px solid var(--cs-border-soft)",
                  padding: "0.875rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  boxShadow: "var(--cs-shadow-xs)",
                  minHeight: 86,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: "var(--cs-surface-warm)",
                    border: "1px solid var(--cs-border-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={17} color="var(--cs-staff-accent)" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", lineHeight: 1.25 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2, lineHeight: 1.3 }}>
                    {desc}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
