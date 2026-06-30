"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ReadinessResult, ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import { READINESS_SCOPE_META } from "@/types/readiness";

// ── Status config ─────────────────────────────────────────────────────────────

type StatusConfig = {
  icon: string;
  label: string;
  bg: string;
  border: string;
  color: string;
};

const STATUS_CONFIG: Record<ReadinessStatus, StatusConfig> = {
  ok: {
    icon: "✅",
    label: "System Ready",
    bg: "rgba(90, 138, 106, 0.10)",
    border: "rgba(90, 138, 106, 0.30)",
    color: "#5A8A6A",
  },
  warning: {
    icon: "⚠️",
    label: "System",
    bg: "rgba(166, 123, 91, 0.10)",
    border: "rgba(166, 123, 91, 0.30)",
    color: "#A67B5B",
  },
  critical: {
    icon: "⛔",
    label: "Critical",
    bg: "rgba(192, 57, 43, 0.10)",
    border: "rgba(192, 57, 43, 0.30)",
    color: "var(--cs-error, #c0392b)",
  },
};

const FALLBACK_CONFIG: StatusConfig = {
  icon: "⚠️",
  label: "Unavailable",
  bg: "var(--cs-surface-raised)",
  border: "var(--cs-border-soft)",
  color: "var(--cs-text-muted)",
};

// ── Issue row ─────────────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: ReadinessIssue }) {
  const scopeMeta = READINESS_SCOPE_META[issue.scope] ?? { label: issue.scope, icon: "📋" };
  const sevColor =
    issue.severity === "critical"
      ? "var(--cs-error)"
      : issue.severity === "warning"
        ? "var(--cs-warning)"
        : "var(--cs-info)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11 }} aria-hidden="true">
          {scopeMeta.icon}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--cs-text)",
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {issue.title}
        </span>
        {issue.count !== undefined && issue.count > 1 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: sevColor,
              background: `${sevColor}15`,
              padding: "1px 6px",
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            {issue.count}
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--cs-text-secondary)", lineHeight: 1.4 }}>
        {issue.problem}
      </div>

      {issue.actionHref && (
        <Link
          href={issue.actionHref}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: sevColor,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
          }}
        >
          {issue.actionLabel} ›
        </Link>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type WorkspaceReadinessIndicatorProps = {
  /** null when getCrmReadiness failed — renders a safe fallback. */
  readiness: ReadinessResult | null;
  canOpenAdminSetup?: boolean;
};

export function WorkspaceReadinessIndicator({
  readiness,
  canOpenAdminSetup = false,
}: WorkspaceReadinessIndicatorProps) {
  const [open, setOpen] = useState(false);

  // Close popover on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const criticalCount = readiness?.issues.filter((i) => i.severity === "critical").length ?? 0;
  const warningCount = readiness?.issues.filter((i) => i.severity === "warning").length ?? 0;
  const totalCount = readiness?.issues.length ?? 0;
  const status = readiness?.status ?? "ok";

  const cfg = readiness ? (STATUS_CONFIG[status] ?? STATUS_CONFIG.ok) : FALLBACK_CONFIG;

  const chipText =
    !readiness
      ? "Unavailable"
      : totalCount === 0
        ? "System Ready"
        : criticalCount > 0
          ? `Critical: ${criticalCount} issue${criticalCount !== 1 ? "s" : ""}`
          : `System: ${warningCount} issue${warningCount !== 1 ? "s" : ""}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-expanded={open}
        aria-controls="readiness-popover"
        aria-label={`System readiness: ${chipText}. ${totalCount} total issue${totalCount !== 1 ? "s" : ""}. Click to review.`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 10px",
          borderRadius: 9999,
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          flexShrink: 0,
          whiteSpace: "nowrap",
          transition: "opacity 0.15s, background-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "var(--cs-surface-raised)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = cfg.bg;
        }}
      >
        <span style={{ fontSize: 13 }} aria-hidden="true">
          {cfg.icon}
        </span>
        <span className="hidden sm:inline">{chipText}</span>
        <span className="sm:hidden">{totalCount > 0 ? totalCount : "✓"}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }} aria-hidden="true">
          ▾
        </span>
      </PopoverTrigger>

      <PopoverContent
        id="readiness-popover"
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-80 sm:w-96 p-0"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "min(70vh, 520px)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              borderBottom: "1px solid var(--cs-border-soft)",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14 }} aria-hidden="true">
              {cfg.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>
                System Readiness
              </div>
              <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
                {!readiness
                  ? "Status unavailable"
                  : totalCount === 0
                    ? "All systems look good"
                    : `${totalCount} issue${totalCount !== 1 ? "s" : ""} need${totalCount === 1 ? "s" : ""} review`}
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {!readiness ? (
              <div style={{ fontSize: 12, color: "var(--cs-text-muted)", padding: "8px 0" }}>
                Could not load readiness status. Try refreshing or open Admin & Setup.
              </div>
            ) : totalCount === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0",
                  color: "var(--cs-text-muted)",
                  fontSize: 12,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 600, color: "var(--cs-success)", marginBottom: 4 }}>
                  All clear
                </div>
                <div>No readiness issues were found.</div>
              </div>
            ) : (
              <>
                {readiness.issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          {canOpenAdminSetup ? (
            <div
              style={{
                padding: "10px 12px",
                borderTop: "1px solid var(--cs-border-soft)",
                flexShrink: 0,
              }}
            >
              <Link
                href="/crm/setup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  width: "100%",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--cs-text-secondary)",
                  textDecoration: "none",
                  padding: "7px 10px",
                  border: "1px solid var(--cs-border-soft)",
                  borderRadius: 8,
                  background: "var(--cs-surface)",
                  transition: "background 0.15s",
                }}
              >
                Open Admin & Setup ›
              </Link>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
