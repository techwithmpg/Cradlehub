import Link from "next/link";

// ── Checklist items ───────────────────────────────────────────────────────────

type ChecklistItem = {
  step: number;
  label: string;
  detail: string;
  link?: { label: string; href: string };
};

const ITEMS: ChecklistItem[] = [
  {
    step: 1,
    label: "Check in staff who have arrived",
    detail: "Use the Live Board below to mark each present staff member as checked in.",
  },
  {
    step: 2,
    label: "Review missing staff",
    detail: "Staff in the \"Not Checked In\" column are scheduled today but not yet marked present.",
  },
  {
    step: 3,
    label: "Confirm drivers for home-service",
    detail: "Switch to the Driver Readiness tab to verify which drivers are ready for dispatch.",
  },
  {
    step: 4,
    label: "Check schedule issues",
    detail: "Schedule Setup flags staff with no saved individual schedule who should not appear in bookings.",
    link: { label: "Schedule Setup", href: "/crm/schedule?tab=setup" },
  },
  {
    step: 5,
    label: "Open Daily Operations Center to begin",
    detail: "Once readiness is confirmed, manage bookings, walk-ins, and dispatch from Today.",
    link: { label: "Daily Operations Center", href: "/crm/today" },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function StartDayChecklist() {
  return (
    <div
      className="cs-card"
      style={{ padding: "1.125rem 1.25rem" }}
    >
      {/* Header */}
      <div style={{ marginBottom: "0.875rem" }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--cs-text)",
            margin: 0,
          }}
        >
          ☀️ Start-of-Day Checklist
        </h3>
        <p
          style={{
            fontSize: 11,
            color: "var(--cs-text-muted)",
            margin: "0.25rem 0 0",
          }}
        >
          Run through these steps before serving the first customer.
        </p>
      </div>

      {/* Steps */}
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {ITEMS.map((item) => (
          <li
            key={item.step}
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "flex-start",
            }}
          >
            {/* Step number bubble */}
            <div
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--cs-surface-raised)",
                border: "1px solid var(--cs-border-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--cs-text-muted)",
                marginTop: 1,
              }}
            >
              {item.step}
            </div>

            {/* Content */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  marginBottom: 2,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--cs-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                {item.detail}
                {item.link && (
                  <>
                    {" "}
                    <Link
                      href={item.link.href}
                      style={{
                        color: "var(--cs-text-muted)",
                        textDecoration: "underline",
                        textDecorationColor: "var(--cs-border-soft)",
                        fontSize: 11,
                      }}
                    >
                      {item.link.label} →
                    </Link>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
