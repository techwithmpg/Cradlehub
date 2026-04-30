"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, CalendarDays, Building2, Users, Sparkles,
  UserPlus, ClipboardList, Heart, Sun, BarChart2, ClockAlert,
  Menu, X, Gem, Monitor, UserCheck, Truck, Wrench,
} from "lucide-react";
import { NAV_CONFIG, resolveWorkspaceKeyFromPath } from "./nav-config";
import { RoleBadge } from "./role-badge";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  LayoutDashboard, CalendarDays, Building2, Users, Sparkles,
  UserPlus, ClipboardList, Heart, Sun, BarChart2, ClockAlert,
  Gem, Monitor, UserCheck, Truck, Wrench,
};

const WORKSPACE_IDENTITY: Record<string, { label: string; sublabel: string }> = {
  owner:             { label: "Owner's Suite",       sublabel: "Strategic View"    },
  manager:           { label: "Operations",          sublabel: "Manager Dashboard" },
  assistant_manager: { label: "Operations",          sublabel: "Asst. Manager"     },
  store_manager:     { label: "Operations",          sublabel: "Store Manager"     },
  crm:               { label: "CRM Hub",             sublabel: "Guest Relations"   },
  csr:               { label: "Front Desk",          sublabel: "Guest Services"    },
  staff:             { label: "My Workspace",        sublabel: "Service Staff"     },
  driver:            { label: "Driver Panel",        sublabel: "Dispatch"          },
  utility:           { label: "Utility Panel",       sublabel: "Operations Support"},
  dev:               { label: "Dev Panel",           sublabel: "Developer Tools"   },
};

const ROLE_ACCENT: Record<string, string> = {
  owner:             "var(--cs-owner-accent)",
  manager:           "var(--cs-manager-accent)",
  assistant_manager: "var(--cs-manager-accent)",
  store_manager:     "var(--cs-manager-accent)",
  crm:               "var(--cs-crm-accent)",
  csr:               "var(--cs-csr-accent)",
  staff:             "var(--cs-staff-accent)",
  driver:            "var(--cs-staff-accent)",
  utility:           "var(--cs-staff-accent)",
  dev:               "var(--cs-sand)",
};

type SidebarProps = {
  role:        string;
  fullName:    string;
  branchName?: string;
};

type SidebarContentProps = {
  role: string;
  fullName: string;
  branchName?: string;
  pathname: string;
  onNav?: () => void;
};

function SidebarContent({ role, fullName, branchName, pathname, onNav }: SidebarContentProps) {
  const workspaceKey = resolveWorkspaceKeyFromPath(pathname) ?? "staff";
  const nav = NAV_CONFIG[workspaceKey];
  const identity = WORKSPACE_IDENTITY[workspaceKey] ?? { label: "Workspace", sublabel: workspaceKey };
  const accent = ROLE_ACCENT[workspaceKey] ?? "var(--cs-sand)";
  if (!nav) return null;

  return (
    <aside style={{
      width:           248,
      minHeight:       "100vh",
      backgroundColor: "var(--cs-sidebar-bg)",
      display:         "flex",
      flexDirection:   "column",
      flexShrink:      0,
    }}>

      {/* Brand header */}
      <div style={{
        padding:   "1.375rem 1.25rem 1rem",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.875rem" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, var(--cs-sand), var(--cs-clay))`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>C</span>
          </div>
          <div>
            <div style={{
              fontSize:   "0.9375rem",
              fontWeight: 600,
              color:      "#F9F6F0",
              fontFamily: "var(--font-display)",
              lineHeight: 1.1,
            }}>
              Cradle Spa
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--cs-sidebar-label)", marginTop: 2 }}>
              {branchName ?? "All Branches"}
            </div>
          </div>
        </div>

        {/* Workspace identity badge */}
        <div style={{
          padding:         "6px 10px",
          borderRadius:    "var(--cs-radius-sm)",
          backgroundColor: "rgba(255,255,255,0.05)",
          border:          "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--cs-sidebar-label)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {identity.sublabel}
          </div>
          <div style={{
            fontSize:   "0.8125rem",
            fontWeight: 600,
            color:      accent,
            marginTop:  1,
          }}>
            {identity.label}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "0.875rem 0.75rem", overflowY: "auto" }}>
        {nav.items.map((item) => {
          const Icon     = ICON_MAP[item.icon];
          const isRootWorkspace = ["/manager", "/owner", "/crm", "/staff-portal", "/driver", "/utility", "/dev"].includes(item.href);
          const isActive = isRootWorkspace
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              style={{
                display:         "flex",
                alignItems:      "center",
                gap:             10,
                padding:         "9px 10px",
                borderRadius:    "var(--cs-radius-sm)",
                marginBottom:    2,
                fontSize:        "0.875rem",
                fontWeight:      isActive ? 500 : 400,
                color:           isActive ? "#F9F6F0" : "var(--cs-sidebar-text)",
                backgroundColor: isActive ? "var(--cs-sidebar-active)" : "transparent",
                textDecoration:  "none",
                transition:      "var(--cs-transition)",
                borderLeft:      isActive ? `2.5px solid ${accent}` : "2.5px solid transparent",
              }}
            >
              {Icon && <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />}
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && (
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  backgroundColor: accent,
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{
        padding:      "0.875rem 1.25rem",
        borderTop:    "1px solid rgba(255,255,255,0.06)",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: `linear-gradient(135deg, ${accent}33, ${accent}22)`,
          border: `1px solid ${accent}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: accent, flexShrink: 0,
        }}>
          {fullName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize:     "0.8125rem",
            fontWeight:   500,
            color:        "#E8E0D5",
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
          }}>
            {fullName}
          </div>
          <RoleBadge role={role} />
        </div>
      </div>
    </aside>
  );
}

export function Sidebar({ role, fullName, branchName }: SidebarProps) {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex" style={{ position: "sticky", top: 0, height: "100vh" }}>
        <SidebarContent role={role} fullName={fullName} branchName={branchName} pathname={pathname} />
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", top: 12, left: 12, zIndex: 50,
          padding: 8, borderRadius: 8, backgroundColor: "var(--cs-sidebar-bg)",
          border: "none", cursor: "pointer", color: "var(--cs-sidebar-text)",
        }}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(44,42,41,0.6)" }} />
          <div style={{ position: "fixed", left: 0, top: 0, zIndex: 50, height: "100vh" }}>
            <button onClick={() => setOpen(false)} style={{ position: "absolute", top: 12, right: -36, zIndex: 51, padding: 4, backgroundColor: "transparent", border: "none", cursor: "pointer", color: "#fff" }}>
              <X size={20} />
            </button>
            <SidebarContent role={role} fullName={fullName} branchName={branchName} pathname={pathname} onNav={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
