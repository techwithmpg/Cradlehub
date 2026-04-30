type BookingProgressProps = {
  currentStep: 1 | 2 | 3 | 4;
};

const STEPS = [
  { n: 1, label: "Branch" },
  { n: 2, label: "Service" },
  { n: 3, label: "Time" },
  { n: 4, label: "Details" },
] as const;

export function BookingProgress({ currentStep }: BookingProgressProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: "1.75rem",
      }}
    >
      {STEPS.map((step, i) => {
        const isDone = step.n < currentStep;
        const isActive = step.n === currentStep;

        return (
          <div
            key={step.n}
            style={{
              display: "flex",
              alignItems: "center",
              flex: i < STEPS.length - 1 ? 1 : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: isDone || isActive ? "var(--cs-sand)" : "var(--cs-border)",
                  border: isDone || isActive ? "none" : "1.5px solid var(--cs-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: isDone || isActive ? "#fff" : "var(--cs-text-muted)",
                  transition: "background-color 0.2s",
                }}
              >
                {isDone ? "✓" : step.n}
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--cs-sand)"
                    : isDone
                      ? "var(--cs-text-muted)"
                      : "var(--cs-text-muted)",
                  marginTop: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </div>
            </div>

            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: isDone ? "var(--cs-sand)" : "var(--cs-border)",
                  margin: "0 4px",
                  marginBottom: 20,
                  transition: "background-color 0.2s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
