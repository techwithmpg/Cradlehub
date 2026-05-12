import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";

async function logoutAction() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

import { UserAvatar } from "@/components/shared/user-avatar";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { WorkspaceBreadcrumb } from "./workspace-breadcrumb";

type HeaderProps = {
  role:      string;
  fullName:  string;
  avatarUrl?: string | null;
};

export function Header({ role, fullName, avatarUrl }: HeaderProps) {
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
      <WorkspaceBreadcrumb role={role} />

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

        <NotificationBell role={role} />

        <div style={{ width: 1, height: 16, background: "var(--cs-border)", margin: "0 2px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <UserAvatar
            name={fullName}
            imageUrl={avatarUrl}
            size="sm"
            className="border border-border-soft"
          />
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
