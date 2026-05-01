"use client";

import Link            from "next/link";
import { usePathname } from "next/navigation";
import { useState }    from "react";
import {
  LayoutDashboard, CalendarDays, Building2, Users, Sparkles,
  UserPlus, ClipboardList, Heart, Sun, BarChart2, ClockAlert,
  Menu, X, TrendingUp, BookOpen, Clock, UserCheck, Activity,
  ChevronRight, Truck, Wrench, Monitor,
} from "lucide-react";
import { NAV_CONFIG, resolveWorkspaceKeyFromPath, resolveWorkspaceKeyFromRole } from "./nav-config";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  LayoutDashboard, CalendarDays, Building2, Users, Sparkles,
  UserPlus, ClipboardList, Heart, Sun, BarChart2, ClockAlert,
  TrendingUp, BookOpen, Clock, UserCheck, Activity, Truck, Wrench, Monitor,
};

const WORKSPACE_META: Record<string, {
  label:    string;
  sublabel: string;
  accent:   string;
  accentBg: string;
  icon:     string;
}> = {
  owner: {
    label:    "OWNER WORKSPACE",
    sublabel: "Owner access",
    accent:   "var(--cs-owner-accent)",
    accentBg: "rgba(122, 90, 138, 0.15)",
    icon:     "◆",
  },
  manager: {
    label:    "MANAGER WORKSPACE",
    sublabel: "Manager access",
    accent:   "var(--cs-manager-accent)",
    accentBg: "rgba(90, 122, 138, 0.15)",
    icon:     "▸",
  },
  assistant_manager: {
    label:    "MANAGER WORKSPACE",
    sublabel: "Assistant manager access",
    accent:   "var(--cs-manager-accent)",
    accentBg: "rgba(90, 122, 138, 0.15)",
    icon:     "▸",
  },
  store_manager: {
    label:    "MANAGER WORKSPACE",
    sublabel: "Store manager access",
    accent:   "var(--cs-manager-accent)",
    accentBg: "rgba(90, 122, 138, 0.15)",
    icon:     "▸",
  },
  csr: {
    label:    "CSR WORKSPACE",
    sublabel: "Customer service access",
    accent:   "var(--cs-csr-accent)",
    accentBg: "rgba(138, 122, 90, 0.15)",
    icon:     "◇",
  },
  crm: {
    label:    "CRM WORKSPACE",
    sublabel: "CRM access",
    accent:   "var(--cs-crm-accent)",
    accentBg: "rgba(90, 138, 106, 0.15)",
    icon:     "✦",
  },
  staff: {
    label:    "STAFF WORKSPACE",
    sublabel: "Staff portal access",
    accent:   "var(--cs-staff-accent)",
    accentBg: "rgba(138, 106, 90, 0.15)",
    icon:     "○",
  },
  driver: {
    label:    "DRIVER WORKSPACE",
    sublabel: "Driver portal access",
    accent:   "var(--cs-sand)",
    accentBg: "rgba(200, 169, 107, 0.15)",
    icon:     "◈",
  },
  utility: {
    label:    "UTILITY WORKSPACE",
    sublabel: "Utility portal access",
    accent:   "var(--cs-sand)",
    accentBg: "rgba(200, 169, 107, 0.15)",
    icon:     "◍",
  },
};

type SidebarProps = {
  role:        string;
  fullName:    string;
  branchName?: string;
};

type SidebarContentProps = SidebarProps & {
  pathname: string;
  onNav?:   () => void;
};

function SidebarContent({ role, fullName, branchName, pathname, onNav }: SidebarContentProps) {
  const workspaceKey = resolveWorkspaceKeyFromPath(pathname) ?? resolveWorkspaceKeyFromRole(role);
  const nav          = NAV_CONFIG[workspaceKey];
  const meta         = WORKSPACE_META[role] ?? WORKSPACE_META[workspaceKey] ?? WORKSPACE_META["staff"]!;
  if (!nav) return null;

  const initials = fullName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside style={{
      width:           248,
      height:          "100vh",
      backgroundColor: "var(--cs-sidebar)",
      display:         "flex",
      flexDirection:   "column",
      flexShrink:      0,
      overflowY:       "auto",
    }}>

      {/* Brand */}
      <div style={{
        padding:      "18px 16px 14px",
        borderBottom: "1px solid var(--cs-sidebar-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width:          32,
            height:         32,
            borderRadius:   "var(--cs-r-sm)",
            background:     "linear-gradient(135deg, var(--cs-sand), var(--cs-sand-light))",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <span style={{
              color:         "#fff",
              fontSize:      13,
              fontWeight:    600,
              fontFamily:    "var(--cs-font-display)",
              letterSpacing: "0.05em",
            }}>
              C
            </span>
          </div>
          <div>
            <div style={{
              fontSize:      12,
              fontWeight:    600,
              color:         "var(--cs-text-inverse)",
              fontFamily:    "var(--cs-font-display)",
              letterSpacing: "0.08em",
              lineHeight:    1.1,
            }}>
              CradleHub
            </div>
            <div style={{
              fontSize:  10,
              color:     "var(--cs-sidebar-muted)",
              marginTop: 2,
            }}>
              {branchName ?? "All Branches"}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace identity badge */}
      <div style={{ padding: "12px 16px 10px" }}>
        <div style={{
          padding:      "9px 11px",
          borderRadius: "var(--cs-r-sm)",
          background:   meta.accentBg,
          border:       `1px solid ${meta.accent.replace("var(", "").replace(")", "")}22`,
          display:      "flex",
          alignItems:   "center",
          gap:          8,
        }}>
          <div style={{
            width:           26,
            height:          26,
            borderRadius:    "var(--cs-r-xs)",
            background:      `${meta.accentBg}`,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            flexShrink:      0,
            color:           meta.accent,
            fontSize:        14,
          }}>
            {meta.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize:      11,
              fontWeight:    600,
              color:         meta.accent,
              lineHeight:    1.1,
              letterSpacing: "0.02em",
            }}>
              {meta.label}
            </div>
            <div style={{
              fontSize:     10,
              color:        "var(--cs-sidebar-muted)",
              marginTop:    2,
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}>
              {meta.sublabel}
            </div>
          </div>
        </div>
      </div>

      {/* Nav section label */}
      <div style={{
        padding:       "2px 16px 6px",
        fontSize:      9.5,
        fontWeight:    600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color:         "var(--cs-sidebar-muted)",
      }}>
        Navigation
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "0 8px" }}>
        {nav.items.map(item => {
          const Icon          = ICON_MAP[item.icon];
          const isRootSection = ["/manager", "/owner", "/crm", "/staff-portal", "/driver", "/utility", "/dev"].includes(item.href);
          const isActive      = isRootSection
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
                gap:             9,
                padding:         "8px 10px",
                borderRadius:    "var(--cs-r-sm)",
                marginBottom:    2,
                fontSize:        13,
                fontWeight:      isActive ? 500 : 400,
                color:           isActive ? "var(--cs-text-inverse)" : "var(--cs-sidebar-text)",
                backgroundColor: isActive ? "var(--cs-sidebar-active)" : "transparent",
                textDecoration:  "none",
                transition:      "background-color var(--cs-duration) var(--cs-ease), color var(--cs-duration) var(--cs-ease)",
                position:        "relative",
              }}
            >
              {isActive && (
                <div style={{
                  position:     "absolute",
                  left:         0,
                  top:          "25%",
                  bottom:       "25%",
                  width:        2.5,
                  borderRadius: 2,
                  background:   meta.accent,
                }} />
              )}

              {Icon && (
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
              )}

              <span style={{ flex: 1 }}>{item.label}</span>

              {isActive && (
                <ChevronRight
                  size={12}
                  strokeWidth={2}
                  style={{ color: "var(--cs-sidebar-muted)", flexShrink: 0 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom – user */}
      <div style={{
        borderTop: "1px solid var(--cs-sidebar-border)",
        padding:   "12px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width:          32,
            height:         32,
            borderRadius:   "50%",
            background:     meta.accentBg,
            border:         `1.5px solid ${meta.accent}44`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       11,
            fontWeight:     600,
            color:          meta.accent,
            flexShrink:     0,
          }}>
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize:     12,
              fontWeight:   500,
              color:        "#E8DDD5",
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}>
              {fullName}
            </div>
            <div style={{
              fontSize:  10,
              color:     "var(--cs-sidebar-muted)",
              marginTop: 1,
            }}>
              {meta.label}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Sidebar({ role, fullName, branchName }: SidebarProps) {
  const pathname        = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex" style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
        <SidebarContent role={role} fullName={fullName} branchName={branchName} pathname={pathname} />
      </div>

      {/* Mobile hamburger */}
      <button
        type="button"
        className="md:hidden"
        onClick={() => setOpen(true)}
        style={{
          position:        "fixed",
          top:             12,
          left:            12,
          zIndex:          50,
          padding:         8,
          borderRadius:    "var(--cs-r-sm)",
          backgroundColor: "var(--cs-sidebar)",
          border:          "none",
          cursor:          "pointer",
          color:           "var(--cs-sidebar-text)",
          boxShadow:       "var(--cs-shadow-md)",
        }}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(30,25,22,0.55)" }}
          />
          <div style={{ position: "fixed", top: 0, left: 0, zIndex: 50, height: "100vh" }}>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{
                position:        "absolute",
                top:             14,
                right:           -40,
                padding:         6,
                backgroundColor: "transparent",
                border:          "none",
                cursor:          "pointer",
                color:           "#fff",
              }}
            >
              <X size={20} />
            </button>
            <SidebarContent
              role={role}
              fullName={fullName}
              branchName={branchName}
              pathname={pathname}
              onNav={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
