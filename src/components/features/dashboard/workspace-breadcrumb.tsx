"use client";

import { usePathname } from "next/navigation";
import { canonicalizeSystemRole } from "@/constants/staff-roles";
import { resolveWorkspaceKeyFromPath, resolveWorkspaceKeyFromRole } from "./nav-config";

const WORKSPACE_LABEL: Record<string, string> = {
  owner: "Owner Workspace",
  manager: "Manager Workspace",
  crm: "Front Desk Workspace",
  staff: "Staff Workspace",
  driver: "Driver Workspace",
  utility: "Utility Workspace",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner access",
  manager: "Manager access",
  assistant_manager: "Asst. Manager access",
  store_manager: "Store Manager access",
  crm: "Front Desk access",
  staff: "Staff access",
  service_head: "Service Head access",
  service_staff: "Service Staff access",
  driver: "Driver access",
  utility: "Utility access",
};

const ROLE_ACCENT: Record<string, string> = {
  owner: "var(--cs-owner-accent)",
  manager: "var(--cs-manager-accent)",
  assistant_manager: "var(--cs-manager-accent)",
  store_manager: "var(--cs-manager-accent)",
  crm: "var(--cs-crm-accent)",
  staff: "var(--cs-staff-accent)",
  driver: "var(--cs-sand)",
  utility: "var(--cs-sand)",
};

export function WorkspaceBreadcrumb({ role }: { role: string }) {
  const pathname = usePathname();
  const canonicalRole = canonicalizeSystemRole(role);
  const pathKey = resolveWorkspaceKeyFromPath(pathname);
  const roleKey = resolveWorkspaceKeyFromRole(canonicalRole);

  const workspaceKey = pathKey ?? roleKey;
  const workspaceLabel = WORKSPACE_LABEL[workspaceKey] ?? "Dashboard";
  const roleLabel = ROLE_LABEL[canonicalRole] ?? canonicalRole;
  const accent = ROLE_ACCENT[canonicalRole] ?? "var(--cs-sand)";

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: "1 1 auto", paddingLeft: 40 }}
      className="md:pl-0"
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: accent,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--cs-text)",
          fontFamily: "var(--cs-font-body)",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {workspaceLabel}
      </span>
      <span
        className="hidden lg:inline"
        style={{
          fontSize: 11,
          color: "var(--cs-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        · {roleLabel}
      </span>
    </div>
  );
}
