import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "./role-badge";

async function logoutAction() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const WORKSPACE_TITLES: Record<string, string> = {
  owner:             "Owner's Suite",
  manager:           "Operations Dashboard",
  assistant_manager: "Operations Dashboard",
  store_manager:     "Branch Operations",
  crm:               "CRM Hub",
  csr:               "Front Desk",
  staff:             "Therapist Workspace",
};

type HeaderProps = {
  role:     string;
  fullName: string;
};

export function Header({ role, fullName }: HeaderProps) {
  const workspaceTitle = WORKSPACE_TITLES[role] ?? "CradleHub";

  return (
    <header style={{
      height:          56,
      backgroundColor: "rgba(249, 246, 240, 0.94)",
      backdropFilter:  "blur(12px)",
      borderBottom:    "1px solid var(--cs-border)",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "space-between",
      padding:         "0 1.5rem",
      position:        "sticky",
      top:             0,
      zIndex:          20,
    }}>
      {/* Left: workspace label */}
      <div style={{ paddingLeft: 44 }} className="md:pl-0">
        <span style={{
          fontSize:   "0.9375rem",
          fontWeight: 600,
          color:      "var(--cs-text)",
          fontFamily: "var(--font-display)",
        }}>
          {workspaceTitle}
        </span>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="hidden sm:flex" style={{ alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>
            {fullName}
          </span>
          <RoleBadge role={role} />
        </div>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            style={{
              fontSize:   "0.8125rem",
              color:      "var(--cs-text-muted)",
              padding:    "0.25rem 0.625rem",
            }}
          >
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
