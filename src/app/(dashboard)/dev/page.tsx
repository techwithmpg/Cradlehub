import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { getAllBranches } from "@/lib/queries/branches";

async function requireDevAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role, full_name, tier, branch_id, is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const devMode = process.env.NODE_ENV !== "production" && process.env.DEV_ALLOW_ALL_MODULES === "true";
  if (me?.system_role !== "owner" && !devMode) {
    redirect("/");
  }

  return { user, me };
}

const CATEGORIES = [
  {
    title: "👑 Owner Suite",
    color: "var(--cs-owner-accent)",
    links: [
      { icon: "📊", label: "Overview", href: "/owner" },
      { icon: "📅", label: "Bookings", href: "/owner/bookings" },
      { icon: "🏢", label: "Branches", href: "/owner/branches" },
      { icon: "👥", label: "Staff", href: "/owner/staff" },
      { icon: "✨", label: "Services", href: "/owner/services" },
    ],
  },
  {
    title: "⚙️ Manager Operations",
    color: "var(--cs-manager-accent)",
    links: [
      { icon: "📋", label: "Today", href: "/manager" },
      { icon: "🗓️", label: "Schedule", href: "/manager/schedule" },
      { icon: "📊", label: "Bookings", href: "/manager/bookings" },
      { icon: "👥", label: "Staff", href: "/manager/staff" },
      { icon: "🔧", label: "Operations", href: "/manager/operations" },
      { icon: "📈", label: "Reports", href: "/manager/reports" },
    ],
  },
  {
    title: "🤝 CRM / Front Desk",
    color: "var(--cs-crm-accent)",
    links: [
      { icon: "🤝", label: "CRM Hub", href: "/crm" },
      { icon: "💛", label: "Repeat Clients", href: "/crm/repeats" },
      { icon: "🔔", label: "Lapsed Clients", href: "/crm/lapsed" },
    ],
  },
  {
    title: "☀️ Service Staff",
    color: "var(--cs-staff-accent)",
    links: [
      { icon: "☀️", label: "Today", href: "/staff-portal" },
      { icon: "🗓️", label: "My Week", href: "/staff-portal/week" },
      { icon: "📊", label: "My Stats", href: "/staff-portal/stats" },
    ],
  },
  {
    title: "🔧 Specialized Roles",
    color: "var(--cs-sand)",
    links: [
      { icon: "🚗", label: "Driver Panel", href: "/driver" },
      { icon: "🧹", label: "Utility Panel", href: "/utility" },
    ],
  },
  {
    title: "🌐 Public Facing",
    color: "var(--cs-sand-light)",
    links: [
      { icon: "🏠", label: "Homepage", href: "/" },
      { icon: "📅", label: "Book Online", href: "/book" },
      { icon: "🏢", label: "Branches", href: "/branches" },
      { icon: "✨", label: "Services", href: "/services" },
    ],
  },
];

export default async function DevPanelPage() {
  const { user, me } = await requireDevAccess();
  const branches = await getAllBranches();

  const devMode = process.env.NODE_ENV !== "production" && process.env.DEV_ALLOW_ALL_MODULES === "true";

  return (
    <div>
      <PageHeader
        title="Dev Panel"
        description="Developer tools, session info, and quick navigation across all workspaces."
        icon="🛠️"
      />

      {/* Session Card */}
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.75rem",
          }}
        >
          Session Profile
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.5rem" }}>
          {[
            { label: "Auth User ID", value: user.id },
            { label: "Email", value: user.email ?? "—" },
            { label: "Name", value: me?.full_name ?? "—" },
            { label: "System Role", value: me?.system_role ?? "—" },
            { label: "Staff Type", value: "—" },
            { label: "Tier", value: me?.tier ?? "—" },
            { label: "Branch ID", value: me?.branch_id ?? "—" },
            { label: "Active", value: me?.is_active ? "Yes" : "No" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", gap: 8, fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--cs-text-muted)", minWidth: 90 }}>{row.label}</span>
              <span style={{ color: "var(--cs-text)", fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Environment */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            backgroundColor: process.env.NODE_ENV !== "production" ? "var(--cs-success-bg)" : "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            fontSize: "0.8125rem",
            color: process.env.NODE_ENV !== "production" ? "var(--cs-success)" : "var(--cs-text)",
          }}
        >
          NODE_ENV: {process.env.NODE_ENV ?? "undefined"}
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            backgroundColor: devMode ? "var(--cs-success-bg)" : "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            fontSize: "0.8125rem",
            color: devMode ? "var(--cs-success)" : "var(--cs-text)",
          }}
        >
          DEV_ALLOW_ALL_MODULES: {devMode ? "true ✅" : "false"}
        </div>
      </div>

      {/* Categorized Workspaces */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        {CATEGORIES.map((cat) => (
          <div
            key={cat.title}
            style={{
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface-warm)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: cat.color,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {cat.title}
              </div>
            </div>
            <div style={{ padding: "0.5rem" }}>
              {cat.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--cs-r-sm)",
                    textDecoration: "none",
                    color: "var(--cs-text-secondary)",
                    fontSize: "0.875rem",
                    transition: "var(--cs-trans)",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{link.icon}</span>
                  <span>{link.label}</span>
                  <span style={{ marginLeft: "auto", color: "var(--cs-text-muted)", fontSize: 12 }}>›</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Branches Panel */}
      {branches.length > 0 && (
        <>
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
            Branches ({branches.length})
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {branches.map((branch) => (
              <div
                key={branch.id}
                style={{
                  backgroundColor: "var(--cs-surface)",
                  border: "1px solid var(--cs-border)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "0.875rem 1rem",
                    borderBottom: "1px solid var(--cs-border)",
                    backgroundColor: "var(--cs-surface-warm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "var(--cs-text)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {branch.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--cs-r-pill)",
                      backgroundColor: branch.is_active ? "var(--cs-success-bg)" : "var(--cs-border)",
                      color: branch.is_active ? "var(--cs-success)" : "var(--cs-text-muted)",
                    }}
                  >
                    {branch.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
                <div style={{ padding: "0.5rem" }}>
                  <Link
                    href={`/owner/branches/${branch.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--cs-r-sm)",
                      textDecoration: "none",
                      color: "var(--cs-text-secondary)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🏢</span>
                    Manage Branch
                    <span style={{ marginLeft: "auto", color: "var(--cs-text-muted)", fontSize: 12 }}>›</span>
                  </Link>
                  <Link
                    href={`/manager/bookings?branchId=${branch.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--cs-r-sm)",
                      textDecoration: "none",
                      color: "var(--cs-text-secondary)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📊</span>
                    View Bookings
                    <span style={{ marginLeft: "auto", color: "var(--cs-text-muted)", fontSize: 12 }}>›</span>
                  </Link>
                  <Link
                    href={`/manager?branchId=${branch.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--cs-r-sm)",
                      textDecoration: "none",
                      color: "var(--cs-text-secondary)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📋</span>
                    Today&apos;s Schedule
                    <span style={{ marginLeft: "auto", color: "var(--cs-text-muted)", fontSize: 12 }}>›</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

