/**
 * CrmBookingImpactMatrix
 *
 * Simple read-only table showing which data factors affect each booking type.
 * Informational only — no queries, no mutations.
 *
 * On mobile the table scrolls horizontally inside an overflow container.
 */

type CellValue = "yes" | "no" | "partial" | "text";

type MatrixCell = {
  type: CellValue;
  text?: string;
};

type MatrixRow = {
  factor: string;
  online: MatrixCell;
  inhouse: MatrixCell;
  homeService: MatrixCell;
};

const YES:  MatrixCell = { type: "yes" };
const NO:   MatrixCell = { type: "no" };

function partial(text: string): MatrixCell { return { type: "partial", text }; }
function note(text: string):    MatrixCell { return { type: "text",    text }; }

const ROWS: MatrixRow[] = [
  {
    factor:      "Saved staff schedule",
    online:      YES,
    inhouse:     YES,
    homeService: YES,
  },
  {
    factor:      "Staff-service capability",
    online:      YES,
    inhouse:     YES,
    homeService: YES,
  },
  {
    factor:      "Blocked time",
    online:      YES,
    inhouse:     YES,
    homeService: YES,
  },
  {
    factor:      "Existing bookings",
    online:      YES,
    inhouse:     YES,
    homeService: YES,
  },
  {
    factor:      "Branch service availability",
    online:      YES,
    inhouse:     YES,
    homeService: YES,
  },
  {
    factor:      "Room / resource readiness",
    online:      partial("In-spa slots"),
    inhouse:     YES,
    homeService: partial("Depends on service"),
  },
  {
    factor:      "Daily staff check-in",
    online:      NO,
    inhouse:     YES,
    homeService: partial("CRM-dispatch dependent"),
  },
  {
    factor:      "Driver / dispatch readiness",
    online:      NO,
    inhouse:     note("Home-service only"),
    homeService: YES,
  },
  {
    factor:      "Customer address / location",
    online:      note("Home-service only"),
    inhouse:     note("Home-service only"),
    homeService: YES,
  },
  {
    factor:      "Payment confirmation",
    online:      note("CRM follow-up / hold"),
    inhouse:     YES,
    homeService: note("CRM confirmation"),
  },
];

function CellContent({ cell }: { cell: MatrixCell }) {
  if (cell.type === "yes") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--cs-success-bg)",
          color: "var(--cs-success)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        ✓
      </span>
    );
  }
  if (cell.type === "no") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "rgba(192,57,43,0.08)",
          color: "var(--cs-error, #c0392b)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        ✕
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: "0.6875rem",
        color: "var(--cs-text-muted)",
        fontStyle: "italic",
        lineHeight: 1.3,
      }}
    >
      {cell.text}
    </span>
  );
}

export function CrmBookingImpactMatrix() {
  return (
    <div className="cs-card" style={{ padding: "1.125rem 1.25rem" }}>
      <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginBottom: "1rem" }}>
        Which data the booking engine reads depends on the booking source and delivery type.
      </div>

      {/* Scrollable wrapper for narrow viewports */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table
          style={{
            width: "100%",
            minWidth: 460,
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--cs-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid var(--cs-border)",
                  width: "40%",
                }}
              >
                Factor
              </th>
              {(["Online", "In-House", "Home-Service"] as const).map((col) => (
                <th
                  key={col}
                  style={{
                    textAlign: "center",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: "var(--cs-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--cs-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.factor}
                style={{
                  background: i % 2 === 0 ? "transparent" : "var(--cs-surface-warm)",
                }}
              >
                <td
                  style={{
                    padding: "0.5rem 0.75rem",
                    color: "var(--cs-text-secondary)",
                    fontWeight: 500,
                    borderBottom: "1px solid var(--cs-border-soft)",
                  }}
                >
                  {row.factor}
                </td>
                {([row.online, row.inhouse, row.homeService] as MatrixCell[]).map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      textAlign: "center",
                      padding: "0.5rem 0.75rem",
                      borderBottom: "1px solid var(--cs-border-soft)",
                      verticalAlign: "middle",
                    }}
                  >
                    <CellContent cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
