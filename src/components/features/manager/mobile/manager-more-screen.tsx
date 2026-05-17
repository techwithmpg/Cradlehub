"use client";

import Link from "next/link";
import {
  Building2,
  Clock,
  User,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

type Props = {
  branchName: string;
};

export function ManagerMoreScreen({ branchName }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          More
        </h1>
        <p style={{ fontSize: 13, color: "var(--cs-text-muted)", margin: "4px 0 0" }}>
          Tools and settings
        </p>
      </div>

      {/* Branch Summary Card */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "var(--cs-shadow-xs)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--cs-r-md)",
              background: "var(--cs-sand-tint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cs-sand-dark)",
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cs-text)" }}>{branchName}</div>
            <div style={{ fontSize: 12, color: "var(--cs-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} /> Open today
            </div>
          </div>
        </div>
        <Link
          href="/manager/settings"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 0",
            borderRadius: "var(--cs-r-md)",
            background: "var(--cs-sand-tint)",
            color: "var(--cs-sand-dark)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          View Branch
        </Link>
      </div>

      {/* Recent Alerts */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "var(--cs-shadow-xs)",
        }}
      >
        <AlertTriangle size={18} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13, color: "var(--cs-text-muted)" }}>No recent alerts</div>
      </div>

      {/* Menu List */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          overflow: "hidden",
          boxShadow: "var(--cs-shadow-xs)",
        }}
      >
        <MenuItem icon={Bell} label="Notifications" href="/manager/notifications" />
        <MenuItem icon={Building2} label="Spaces & Rooms" href="/manager/spaces-rules" />
        <MenuItem icon={Sparkles} label="Services" href="/manager/services" />
        <MenuItem icon={Settings} label="Settings" href="/manager/settings" />
        <MenuItem icon={User} label="Branch Info" href="/manager/settings" />
        <MenuItem icon={HelpCircle} label="Help" href="/contact" />
        <MenuItem icon={LogOut} label="Logout" href="/login" isLast />
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  isLast,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  href: string;
  isLast?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        textDecoration: "none",
        color: "var(--cs-text)",
        borderBottom: isLast ? "none" : "1px solid var(--cs-border-soft)",
        transition: "background-color 150ms ease",
      }}
    >
      <Icon size={18} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
      <ChevronRight size={16} style={{ color: "var(--cs-text-subtle)", flexShrink: 0 }} />
    </Link>
  );
}
