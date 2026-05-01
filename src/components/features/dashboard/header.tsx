import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";

async function logoutAction() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const WORKSPACE_LABEL: Record<string, string> = {
  owner:             "Owner",
  manager:           "Manager",
  assistant_manager: "Manager",
  store_manager:     "Manager",
  csr:               "CSR",
  crm:               "CRM",
  staff:             "Staff",
  driver:            "Driver",
  utility:           "Utility",
};

const ROLE_ACCENT: Record<string, string> = {
  owner:             "var(--cs-owner-accent)",
  manager:           "var(--cs-manager-accent)",
  assistant_manager: "var(--cs-manager-accent)",
  store_manager:     "var(--cs-manager-accent)",
  csr:               "var(--cs-csr-accent)",
  crm:               "var(--cs-crm-accent)",
  staff:             "var(--cs-staff-accent)",
};

type HeaderProps = {
  role:     string;
  fullName: string;
};

export function Header({ role, fullName }: HeaderProps) {
  const label  = WORKSPACE_LABEL[role] ?? "Dashboard";
  const accent = ROLE_ACCENT[role] ?? "var(--cs-sand)";

  return (
    <header style={{
      height:          52,
      backgroundColor: "var(--cs-surface)",
      borderBottom:    "1px solid var(--cs-border-soft)",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "space-between",
      padding:         "0 20px",
      position:        "sticky",
      top:             0,
      zIndex:          20,
      boxShadow:       "var(--cs-shadow-xs)",
    }}>

      {/* Left – workspace breadcrumb */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 40 }}
        className="md:pl-0"
      >
        <div style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          background:   accent,
          flexShrink:   0,
        }} />
        <span style={{
          fontSize:   13,
          fontWeight: 500,
          color:      "var(--cs-text)",
          fontFamily: "var(--cs-font-body)",
        }}>
          Workspace: {label}
        </span>
      </div>

      {/* Right – date + user + sign out */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        <div style={{
          fontSize:           11.5,
          color:              "var(--cs-text-subtle)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {new Date().toLocaleDateString("en-PH", {
            weekday: "short", month: "short", day: "numeric",
          })}
        </div>

        <div style={{ width: 1, height: 16, background: "var(--cs-border)", margin: "0 4px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width:          26,
            height:         26,
            borderRadius:   "50%",
            background:     `${accent}22`,
            border:         `1.5px solid ${accent}40`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       10,
            fontWeight:     600,
            color:          accent,
          }}>
            {fullName.charAt(0).toUpperCase()}
          </div>
          <span
            className="hidden sm:block"
            style={{ fontSize: 12.5, color: "var(--cs-text-secondary)" }}
          >
            {fullName.split(" ")[0]}
          </span>
        </div>

        <div style={{ width: 1, height: 16, background: "var(--cs-border)", margin: "0 2px" }} />

        <form action={logoutAction}>
          <button
            type="submit"
            style={{
              padding:      "5px 10px",
              fontSize:     11.5,
              color:        "var(--cs-text-muted)",
              background:   "transparent",
              border:       "none",
              cursor:       "pointer",
              borderRadius: "var(--cs-r-xs)",
              transition:   "var(--cs-trans)",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
