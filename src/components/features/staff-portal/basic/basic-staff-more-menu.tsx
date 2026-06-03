import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  User,
  Bell,
  Settings,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { StaffMobileBottomNav } from "@/components/features/staff-portal/mobile/staff-mobile-bottom-nav";

// ── Logout server action ──────────────────────────────────────────────────────

async function staffLogoutAction() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ── Types ─────────────────────────────────────────────────────────────────────

type LinkRow = {
  kind: "link";
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
};

type LogoutRow = {
  kind: "logout";
  label: string;
  description: string;
  icon: React.ElementType;
};

type MenuRowItem = LinkRow | LogoutRow;

type MenuSection = {
  title: string;
  items: MenuRowItem[];
};

// ── Menu config ───────────────────────────────────────────────────────────────

const SECTIONS: MenuSection[] = [
  {
    title: "Account",
    items: [
      {
        kind: "link",
        label: "Profile",
        description: "View and edit your profile",
        href: "/staff-portal/profile",
        icon: User,
      },
      {
        kind: "link",
        label: "Notifications",
        description: "Manage your notifications",
        href: "/staff-portal/notifications",
        icon: Bell,
      },
      {
        kind: "link",
        label: "Settings",
        description: "App preferences",
        href: "/staff-portal/notifications",
        icon: Settings,
        disabled: true,
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        kind: "link",
        label: "Help & Support",
        description: "Get help and contact support",
        href: "/staff-portal/notifications",
        icon: HelpCircle,
        disabled: true,
      },
      {
        kind: "link",
        label: "Privacy Policy",
        description: "Read our privacy policy",
        href: "/staff-portal/notifications",
        icon: Shield,
        disabled: true,
      },
      {
        kind: "logout",
        label: "Logout",
        description: "Sign out from your account",
        icon: LogOut,
      },
    ],
  },
];

// ── Icon wrapper ──────────────────────────────────────────────────────────────

function IconBox({ icon: Icon, danger = false }: { icon: React.ElementType; danger?: boolean }) {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: danger ? "rgba(239,68,68,0.08)" : "var(--cs-surface-warm)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.15)" : "var(--cs-border-soft)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={17} color={danger ? "#DC2626" : "var(--cs-staff-accent)"} />
    </div>
  );
}

// ── Row content ───────────────────────────────────────────────────────────────

function RowContent({
  item,
  danger = false,
  showChevron = true,
}: {
  item: MenuRowItem;
  danger?: boolean;
  showChevron?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.875rem 1rem",
        gap: "0.875rem",
      }}
    >
      <IconBox icon={item.icon} danger={danger} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: danger ? "#DC2626" : "var(--cs-text)",
            lineHeight: 1.25,
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: danger ? "#EF4444" : "var(--cs-text-muted)",
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {item.description}
        </div>
      </div>

      {showChevron && (
        <ChevronRight
          size={16}
          color={danger ? "#EF4444" : "var(--cs-text-muted)"}
          style={{ flexShrink: 0, opacity: 0.55 }}
        />
      )}
    </div>
  );
}

// ── Menu row ──────────────────────────────────────────────────────────────────

function MenuRow({ item }: { item: MenuRowItem }) {
  if (item.kind === "logout") {
    return (
      <form action={staffLogoutAction} style={{ width: "100%" }}>
        <button
          type="submit"
          style={{
            width: "100%",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <RowContent item={item} danger showChevron={false} />
        </button>
      </form>
    );
  }

  if (item.disabled) {
    return (
      <div style={{ opacity: 0.4, cursor: "not-allowed" }} aria-disabled="true">
        <RowContent item={item} showChevron={false} />
      </div>
    );
  }

  return (
    <Link href={item.href} style={{ textDecoration: "none", display: "block" }}>
      <RowContent item={item} />
    </Link>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function MenuSectionCard({ section }: { section: MenuSection }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cs-text-muted)",
          marginBottom: "0.375rem",
        }}
      >
        {section.title}
      </div>
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          border: "1px solid var(--cs-border-soft)",
          overflow: "hidden",
          boxShadow: "var(--cs-shadow-xs)",
        }}
      >
        {section.items.map((item, idx) => (
          <div key={item.label}>
            {idx > 0 && (
              <div
                style={{
                  height: 1,
                  backgroundColor: "var(--cs-border-soft)",
                  marginLeft: 66,
                }}
              />
            )}
            <MenuRow item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BasicStaffMoreMenu() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
        paddingBottom: 96,
      }}
    >
      {/* Header */}
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
        <h1
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 700,
            color: "var(--cs-text)",
          }}
        >
          More
        </h1>
      </div>

      {/* Menu sections */}
      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {SECTIONS.map((section) => (
          <MenuSectionCard key={section.title} section={section} />
        ))}
      </div>

      <StaffMobileBottomNav />
    </div>
  );
}
