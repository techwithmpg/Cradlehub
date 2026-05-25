import { ReadinessIssueCard } from "./readiness-issue-card";
import { sortReadinessIssues } from "@/types/readiness";
import type { ReadinessIssue } from "@/types/readiness";

// ── Empty state ────────────────────────────────────────────────────────────────

const DEFAULT_EMPTY_TITLE = "No readiness issues found.";
const DEFAULT_EMPTY_DESCRIPTION =
  "The system has the required setup for this area.";

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "1rem 1.125rem",
        backgroundColor: "var(--cs-success-bg, rgba(39,174,96,0.06))",
        border: "1px solid rgba(39, 174, 96, 0.28)",
        borderRadius: "var(--cs-r-sm, 8px)",
        fontSize: "0.875rem",
        color: "var(--cs-success, #27ae60)",
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">
        ✅
      </span>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        {description && (
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
              marginTop: 2,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
  issueCount,
}: {
  title: string;
  description?: string;
  issueCount: number;
}) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            margin: 0,
          }}
        >
          {title}
        </h3>
        {issueCount > 0 && (
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color:
                issueCount > 0
                  ? "var(--cs-warning, #e67e22)"
                  : "var(--cs-text-muted)",
              background:
                issueCount > 0
                  ? "rgba(230,126,34,0.12)"
                  : "var(--cs-surface-raised)",
              padding: "2px 7px",
              borderRadius: 8,
            }}
          >
            {issueCount}
          </span>
        )}
      </div>
      {description && (
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            margin: "0.25rem 0 0",
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type ReadinessIssueListProps = {
  issues: ReadinessIssue[];
  /** Optional section heading shown above the list. */
  title?: string;
  /** Optional description shown beneath the title. */
  description?: string;
  /** Title for the empty-state. Defaults to "No readiness issues found." */
  emptyTitle?: string;
  /** Description for the empty-state. Defaults to system-ready copy. */
  emptyDescription?: string;
  /** Pass to every ReadinessIssueCard for reduced-detail display. */
  compact?: boolean;
  /**
   * Limit displayed items (applied after sorting).
   * Remaining items are counted but not shown.
   */
  maxItems?: number;
};

/**
 * ReadinessIssueList
 *
 * Displays a sorted, optionally-capped list of readiness issues.
 * Issues are ordered critical → warning → info → success, then alphabetically.
 *
 * Server component — no client state.
 *
 * @example
 * <ReadinessIssueList
 *   issues={result.issues}
 *   title="Setup Issues"
 *   description="Resolve these before going live."
 * />
 *
 * // With maxItems cap:
 * <ReadinessIssueList issues={allIssues} maxItems={5} />
 */
export function ReadinessIssueList({
  issues,
  title,
  description,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyDescription = DEFAULT_EMPTY_DESCRIPTION,
  compact = false,
  maxItems,
}: ReadinessIssueListProps) {
  const sorted = sortReadinessIssues(issues);
  const shown = maxItems !== undefined ? sorted.slice(0, maxItems) : sorted;
  const hiddenCount = sorted.length - shown.length;

  return (
    <div>
      {/* Optional section header */}
      {title && (
        <SectionHeader
          title={title}
          description={description}
          issueCount={issues.length}
        />
      )}

      {/* Empty state */}
      {sorted.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: compact ? "0.375rem" : "0.75rem",
          }}
        >
          {shown.map((issue) => (
            <ReadinessIssueCard
              key={issue.id}
              issue={issue}
              compact={compact}
            />
          ))}

          {hiddenCount > 0 && (
            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--cs-text-muted)",
                textAlign: "center",
                padding: "0.5rem",
              }}
            >
              + {hiddenCount} more issue{hiddenCount === 1 ? "" : "s"} not shown
            </div>
          )}
        </div>
      )}
    </div>
  );
}
