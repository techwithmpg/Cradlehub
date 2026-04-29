"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  Sparkles,
  UserPlus,
  ClipboardList,
  Heart,
  Sun,
  BarChart2,
  ClockAlert,
  Menu,
  X,
} from "lucide-react";
import { NAV_CONFIG } from "./nav-config";
import { RoleBadge } from "./role-badge";

const ICON_MAP: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  Sparkles,
  UserPlus,
  ClipboardList,
  Heart,
  Sun,
  BarChart2,
  ClockAlert,
};

type SidebarProps = {
  role: string;
  fullName: string;
  branchName?: string;
};

export function Sidebar({ role, fullName, branchName }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = NAV_CONFIG[role];
  if (!nav) return null;

  const sidebarContent = (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        backgroundColor: "var(--ch-sidebar-bg)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "1.25rem 1.25rem 1rem",
          borderBottom: "1px solid var(--ch-sidebar-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: "var(--ch-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>C</span>
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#FAFAF9" }}>CradleHub</div>
            <div style={{ fontSize: "0.7rem", color: "var(--ch-sidebar-text)", marginTop: 1 }}>
              {branchName ?? "All Branches"}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem 0.625rem", overflowY: "auto" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--ch-sidebar-text)",
            padding: "0.25rem 0.625rem 0.625rem",
          }}
        >
          {nav.label} Workspace
        </div>

        {nav.items.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.5rem 0.625rem",
                borderRadius: 8,
                marginBottom: 2,
                fontSize: "0.875rem",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--ch-sidebar-active)" : "var(--ch-sidebar-text)",
                backgroundColor: isActive ? "var(--ch-sidebar-active-bg)" : "transparent",
                textDecoration: "none",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              {Icon && <Icon size={16} strokeWidth={isActive ? 2 : 1.75} />}
              {item.label}
              {isActive && (
                <span
                  style={{
                    marginLeft: "auto",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: "var(--ch-accent)",
                    flexShrink: 0,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        style={{
          padding: "0.875rem 1.25rem",
          borderTop: "1px solid var(--ch-sidebar-border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: "#292524",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#A8A29E" }}>
            {fullName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#E7E5E4",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {fullName}
          </div>
          <RoleBadge role={role} />
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ position: "sticky", top: 0, height: "100vh" }}>
        {sidebarContent}
      </div>

      {/* Mobile toggle button */}
      <button
        className="md:hidden"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 50,
          padding: 8,
          borderRadius: 8,
          backgroundColor: "var(--ch-sidebar-bg)",
          border: "none",
          cursor: "pointer",
          color: "#A8A29E",
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
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          />
          <div style={{ position: "fixed", left: 0, top: 0, zIndex: 50, height: "100vh" }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                top: 12,
                right: -36,
                zIndex: 51,
                padding: 4,
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#fff",
              }}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
