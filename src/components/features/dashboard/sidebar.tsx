"use client";

import Link            from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback }    from "react";
import {
  LayoutDashboard, CalendarDays, CalendarClock, Building2, Users, Sparkles,
  UserPlus, ClipboardList, Heart, Sun, BarChart2, ClockAlert,
  Menu, X, TrendingUp, BookOpen, Clock, UserCheck, Activity,
  ChevronRight, Truck, Wrench, Monitor,
  MapPin, Settings, Bell, DollarSign, User, ClipboardCheck,
} from "lucide-react";
import { NAV_CONFIG, resolveWorkspaceKeyFromPath, resolveWorkspaceKeyFromRole, type NavGroup, type NavItem } from "./nav-config";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getStaffAdminName, getStaffDisplayName } from "@/lib/staff/display-name";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  LayoutDashboard, CalendarDays, CalendarClock, Building2, Users, Sparkles,
  UserPlus, ClipboardList, Heart, Sun, BarChart2, ClockAlert,
  TrendingUp, BookOpen, Clock, UserCheck, Activity, Truck, Wrench, Monitor,
  MapPin, Settings, Bell, DollarSign, User, ClipboardCheck,
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
  csr: {
    label:    "CSR WORKSPACE",
    sublabel: "Customer service access",
    accent:   "var(--cs-csr-accent)",
    accentBg: "rgba(138, 122, 90, 0.15)",
    icon:     "◇",
  },
  csr_head: {
    label:    "CSR HEAD WORKSPACE",
    sublabel: "Front-desk supervisor access",
    accent:   "var(--cs-csr-head-accent)",
    accentBg: "rgba(122, 106, 74, 0.15)",
    icon:     "◈",
  },
  csr_staff: {
    label:    "CSR WORKSPACE",
    sublabel: "Front-desk access",
    accent:   "var(--cs-csr-staff-accent)",
    accentBg: "rgba(154, 138, 106, 0.15)",
    icon:     "◇",
  },
  crm: {
    label:    "FRONT DESK WORKSPACE",
    sublabel: "Front-desk access",
    accent:   "var(--cs-csr-accent)",
    accentBg: "rgba(138, 122, 90, 0.15)",
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

import { UserAvatar } from "@/components/shared/user-avatar";

type NavLinkProps = {
  item:     NavItem;
  pathname: string;
  accent:   string;
  onNav?:   () => void;
};

function NavLink({ item, pathname, accent, onNav }: NavLinkProps) {
  const Icon          = ICON_MAP[item.icon];
  const router        = useRouter();
  const isRootSection = ["/manager", "/owner", "/crm", "/staff-portal", "/driver", "/utility", "/dev"].includes(item.href);
  const isActive      = isRootSection
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");

  const handleMouseEnter = useCallback(() => {
    try {
      router.prefetch(item.href);
    } catch {
      // Best-effort prefetch.
    }
  }, [router, item.href]);

  return (
    <Link
      href={item.href}
      onClick={onNav}
      onMouseEnter={handleMouseEnter}
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
          background:   accent,
        }} />
      )}
      {Icon && <Icon size={15} strokeWidth={isActive ? 2.25 : 1.75} />}
      <span style={{ flex: 1 }}>{item.label}</span>
      {isActive && (
        <ChevronRight size={12} strokeWidth={2} style={{ color: "var(--cs-sidebar-muted)", flexShrink: 0 }} />
      )}
    </Link>
  );
}

type SidebarProps = {
  role:        string;
  fullName:    string;
  nickname?:   string | null;
  avatarUrl?:  string | null;
  branchName?: string;
};

type SidebarContentProps = SidebarProps & {
  pathname: string;
  onNav?:   () => void;
};

function SidebarContent({ role, fullName, nickname, avatarUrl, branchName, pathname, onNav }: SidebarContentProps) {
  const roleWorkspaceKey = resolveWorkspaceKeyFromRole(role);
  const pathWorkspaceKey = resolveWorkspaceKeyFromPath(pathname);
  const workspaceKey = pathWorkspaceKey ?? roleWorkspaceKey;
  const nav          = NAV_CONFIG[workspaceKey];
  const pathMeta = WORKSPACE_META[pathWorkspaceKey ?? ""] ?? WORKSPACE_META[roleWorkspaceKey] ?? WORKSPACE_META["staff"]!;
  const meta     = pathMeta;
  const displayName = pathname.startsWith("/staff-portal")
    ? getStaffDisplayName({ full_name: fullName, nickname })
    : getStaffAdminName({ full_name: fullName, nickname });
  if (!nav) return null;

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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            href="/"
            onClick={onNav}
            aria-label="Cradle Wellness Living"
            style={{ display: "inline-flex", textDecoration: "none", alignSelf: "flex-start" }}
          >
            <BrandLogo size="sm" className="w-28 md:w-32" />
          </Link>
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

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
        {nav.groups
          ? nav.groups.map((group: NavGroup) => (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div style={{
                  padding:       "8px 8px 4px",
                  fontSize:      9.5,
                  fontWeight:    600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color:         "var(--cs-sidebar-muted)",
                  whiteSpace:    "nowrap",
                }}>
                  {group.label}
                </div>
                {group.items.map((item: NavItem) => (
                  <NavLink key={item.href} item={item} pathname={pathname} accent={meta.accent} onNav={onNav} />
                ))}
              </div>
            ))
          : (nav.items ?? []).map((item: NavItem) => (
              <NavLink key={item.href} item={item} pathname={pathname} accent={meta.accent} onNav={onNav} />
            ))
        }
      </nav>

      {/* Bottom – user */}
      <div style={{
        borderTop: "1px solid var(--cs-sidebar-border)",
        padding:   "12px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UserAvatar
            name={displayName}
            imageUrl={avatarUrl}
            size="md"
            className="size-8 border border-border-soft"
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize:     12,
              fontWeight:   500,
              color:        "#E8DDD5",
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}>
              {displayName}
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

export function Sidebar({ role, fullName, nickname, avatarUrl, branchName }: SidebarProps) {
  const pathname        = usePathname();
  const [open, setOpen] = useState(false);
  // /manager routes now redirect to /crm (MVP soft-pause), but keep the check
  // for safety in case a direct navigation somehow reaches this component.
  const isManagerRoute     = pathname.startsWith("/manager");
  const isStaffPortalRoute = pathname.startsWith("/staff-portal");
  const isDriverRoute      = pathname.startsWith("/driver");

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex" style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
        <SidebarContent
          role={role}
          fullName={fullName}
          nickname={nickname}
          avatarUrl={avatarUrl}
          branchName={branchName}
          pathname={pathname}
        />
      </div>

      {/* Mobile hamburger — hidden on routes that have their own mobile nav (manager, staff-portal, driver) */}
      {!isManagerRoute && !isStaffPortalRoute && !isDriverRoute && (
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
      )}

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
                color: "#fff",
              }}
            >
              <X size={20} />
            </button>
            <SidebarContent
              role={role}
              fullName={fullName}
              nickname={nickname}
              avatarUrl={avatarUrl}
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
