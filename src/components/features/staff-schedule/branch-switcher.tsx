"use client";

import { useRouter, usePathname } from "next/navigation";

type Branch = { id: string; name: string };

type Props = {
  branches: Branch[];
  currentBranchId: string;
};

/**
 * Shown to owners/super-admins when the database has more than one branch.
 * Navigates to ?branch=<id> so the server page re-fetches for the new branch.
 */
export function BranchSwitcher({ branches, currentBranchId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  if (branches.length < 2) return null;

  const current = branches.find((b) => b.id === currentBranchId);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-sm)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        Branch
      </span>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {branches.map((b) => {
          const isActive = b.id === currentBranchId;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                if (!isActive) router.push(`${pathname}?branch=${b.id}`);
              }}
              style={{
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                padding: "4px 12px",
                borderRadius: "var(--cs-r-pill)",
                border: isActive
                  ? "2px solid var(--cs-sand)"
                  : "1px solid var(--cs-border)",
                background: isActive ? "var(--cs-sand-tint)" : "transparent",
                color: isActive ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
                cursor: isActive ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {b.name}
            </button>
          );
        })}
      </div>

      {current && (
        <span
          style={{
            fontSize: 11,
            color: "var(--cs-text-subtle)",
            marginLeft: "auto",
            whiteSpace: "nowrap",
          }}
        >
          Viewing {current.name}
        </span>
      )}
    </div>
  );
}
