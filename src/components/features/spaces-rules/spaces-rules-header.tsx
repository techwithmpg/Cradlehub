"use client";

import { Settings2, Lock } from "lucide-react";

export type SpacesRulesHeaderProps = {
  workspaceContext: "owner" | "manager" | "crm";
  branchId: string;
  branchName: string;
  branches?: { id: string; name: string }[];
  canSwitchBranch: boolean;
  onBranchChange: (branchId: string) => void;
};

const TITLES: Record<SpacesRulesHeaderProps["workspaceContext"], { title: string; subtitle: string }> = {
  owner: {
    title: "Spaces & Rules",
    subtitle: "Manage branch spaces, booking rules, and operational conflicts.",
  },
  manager: {
    title: "Spaces & Rules",
    subtitle: "Manage branch spaces, booking rules, and operational conflicts.",
  },
  crm: {
    title: "Spaces & Availability",
    subtitle: "View available rooms, beds, and resource status for front-desk operations.",
  },
};

export function SpacesRulesHeader({
  workspaceContext,
  branchId,
  branchName,
  branches,
  canSwitchBranch,
  onBranchChange,
}: SpacesRulesHeaderProps) {
  const { title, subtitle } = TITLES[workspaceContext];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--cs-text-muted)",
              margin: "0.25rem 0 0",
            }}
          >
            {subtitle}
          </p>
        </div>

        {canSwitchBranch && branches && branches.length > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <select
              value={branchId}
              onChange={(e) => onBranchChange(e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text)",
                padding: "0 0.75rem",
                fontSize: "0.875rem",
                minWidth: 180,
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--cs-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Settings2 size={12} />
              You&apos;re viewing and managing the selected branch.
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 20,
                backgroundColor: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--cs-text)",
              }}
            >
              <Lock size={12} />
              {branchName} (locked)
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--cs-text-muted)",
              }}
            >
              You&apos;re viewing your assigned branch.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
