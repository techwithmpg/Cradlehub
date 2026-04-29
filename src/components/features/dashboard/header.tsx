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

type HeaderProps = {
  title: string;
  role: string;
  fullName: string;
};

export function Header({ title, role, fullName }: HeaderProps) {
  return (
    <header
      style={{
        height: 56,
        backgroundColor: "var(--ch-surface)",
        borderBottom: "1px solid var(--ch-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.25rem 0 1.25rem",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Page title */}
      <h1
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--ch-text)",
          margin: 0,
          paddingLeft: 36, // clear mobile menu button
        }}
        className="md:pl-0"
      >
        {title}
      </h1>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* User info — hidden on mobile */}
        <div className="hidden sm:flex" style={{ alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)" }}>{fullName}</span>
          <RoleBadge role={role} />
        </div>

        {/* Logout */}
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            style={{
              fontSize: "0.8125rem",
              color: "var(--ch-text-muted)",
              padding: "0.25rem 0.625rem",
            }}
          >
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
