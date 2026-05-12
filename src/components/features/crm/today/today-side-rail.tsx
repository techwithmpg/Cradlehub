"use client";

type PaymentSummary = {
  total_expected: number;
  total_collected: number;
  total_unpaid: number;
  by_method: Record<string, number>;
} | null;

type Props = {
  completed: number;
  inProgress: number;
  upcoming: number;
  cancelledNS: number;
  paymentSummary: PaymentSummary;
};

export function TodaySideRail({
  completed,
  inProgress,
  upcoming,
  cancelledNS,
  paymentSummary,
}: Props) {
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const dayProgress = Math.min(100, Math.round((nowMins / (24 * 60)) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Day Progress */}
      <div className="cs-card" style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.875rem",
          }}
        >
          Day Progress
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--cs-surface-warm)",
            overflow: "hidden",
            marginBottom: "0.75rem",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${dayProgress}%`,
              background: "var(--cs-sand)",
              borderRadius: 3,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {[
            {
              label: "Completed",
              value: completed,
              color: "var(--cs-success)",
            },
            {
              label: "In Progress",
              value: inProgress,
              color: "var(--cs-sand)",
            },
            {
              label: "Upcoming",
              value: upcoming,
              color: "var(--cs-info)",
            },
            {
              label: "Cancelled / No-show",
              value: cancelledNS,
              color: "var(--cs-error)",
            },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--cs-r-sm)",
                backgroundColor: "var(--cs-surface-warm)",
              }}
            >
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--cs-text-secondary)",
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: row.color,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Summary */}
      {paymentSummary && (
        <div className="cs-card" style={{ padding: "1.25rem" }}>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
              marginBottom: "0.875rem",
            }}
          >
            Payment Summary
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {[
              {
                label: "Expected",
                value: `₱${paymentSummary.total_expected.toLocaleString()}`,
                color: "var(--cs-text)",
              },
              {
                label: "Collected",
                value: `₱${paymentSummary.total_collected.toLocaleString()}`,
                color: "var(--cs-success)",
              },
              {
                label: "Outstanding",
                value: `₱${paymentSummary.total_unpaid.toLocaleString()}`,
                color:
                  paymentSummary.total_unpaid > 0
                    ? "var(--cs-error)"
                    : "var(--cs-text-muted)",
              },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--cs-r-sm)",
                  backgroundColor: "var(--cs-surface-warm)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--cs-text-secondary)",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: row.color,
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {/* By-method breakdown */}
          {paymentSummary.total_collected > 0 && (
            <div
              style={{
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--cs-border)",
              }}
            >
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem",
                }}
              >
                By Method
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {(Object.entries(paymentSummary.by_method) as [string, number][])
                  .filter(([, v]) => v > 0)
                  .map(([method, amount]) => (
                    <div
                      key={method}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--cs-text-muted)",
                          textTransform: "capitalize",
                        }}
                      >
                        {method.replace(/_/g, " ")}
                      </span>
                      <span
                        style={{ color: "var(--cs-text)", fontWeight: 500 }}
                      >
                        ₱{amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
