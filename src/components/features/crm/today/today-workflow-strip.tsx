/**
 * TodayWorkflowStrip
 *
 * A visually calm, read-only strip that shows CRM staff the order of daily
 * front-desk work. Purely presentational — no state, no mutations.
 */

const STEPS = [
  "Start Day",
  "Serve Customers",
  "Confirm Bookings",
  "Monitor Operations",
  "Emergency Actions",
] as const;

export function TodayWorkflowStrip() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.25rem",
        marginBottom: "1.5rem",
        padding: "0.625rem 1rem",
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
      }}
    >
      {STEPS.map((step, i) => (
        <span
          key={step}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: i === 0 ? "var(--cs-sand)" : "var(--cs-text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {step}
          </span>
          {i < STEPS.length - 1 && (
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--cs-border)",
                userSelect: "none",
              }}
              aria-hidden="true"
            >
              →
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
