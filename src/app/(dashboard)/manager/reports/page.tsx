import { PageHeader } from "@/components/features/dashboard/page-header";

const COMING_SOON_REPORTS = [
  { icon: "📊", label: "Daily Branch Summary", desc: "Revenue, bookings, and staff utilization for the day" },
  { icon: "👩‍💼", label: "Staff Productivity Report", desc: "Hours worked, bookings served, and revenue per therapist" },
  { icon: "🔄", label: "Booking Conversion & No-shows", desc: "Walk-in vs online ratios and cancellation trends" },
  { icon: "🏠", label: "Home Service Analytics", desc: "Driver performance, travel times, and delivery ratings" },
  { icon: "⭐", label: "Customer Feedback Summary", desc: "Aggregated reviews and satisfaction trends" },
  { icon: "📈", label: "Branch Weekly Trends", desc: "Comparison across days with peak-hour heat maps" },
  { icon: "💰", label: "Revenue by Service Category", desc: "Breakdown across massage, facial, body treatments, etc." },
];

export default function ManagerReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Analytics and insights for data-driven branch management"
        icon="📈"
      />

      <div
        style={{
          backgroundColor: "var(--cs-surface-warm)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "2rem",
          textAlign: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: "0.25rem",
          }}
        >
          Coming Soon
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", maxWidth: 480, margin: "0 auto" }}>
          Reports are being built to give you a complete picture of branch performance. Check back soon.
        </p>
      </div>

      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.75rem",
        }}
      >
        Planned Reports
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {COMING_SOON_REPORTS.map((r) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "1rem",
              borderRadius: "var(--cs-r-lg)",
              backgroundColor: "var(--cs-surface-warm)",
              border: "1px solid var(--cs-border-soft)",
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, filter: "grayscale(0.6)" }}>{r.icon}</span>
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  marginBottom: 2,
                }}
              >
                {r.label}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
                {r.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

