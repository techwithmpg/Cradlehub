"use client";

import Link from "next/link";

export type BookingWidgetProps = {
  branches: { id: string; name: string }[];
  services: { id: string; name: string; duration_minutes: number; price: number }[];
};

export function BookingWidget({ branches, services }: BookingWidgetProps) {
  return (
    <div
      style={{
        background: "var(--pw-white)",
        borderRadius: "var(--pw-radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--pw-shadow-lg)",
        border: "1px solid var(--pw-border-light)",
        maxWidth: 480,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--pw-forest-deep)",
          padding: "18px 22px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--pw-font-display)",
            fontSize: 20,
            fontWeight: 300,
            color: "var(--pw-cream)",
            letterSpacing: "0.02em",
          }}
        >
          Reserve a Session
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "rgba(247,243,237,0.5)",
            marginTop: 3,
          }}
        >
          Confirmed instantly · No deposit required
        </div>
      </div>

      {/* Form */}
      <div style={{ padding: "20px 22px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <WidgetField label="Location">
            <select>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </WidgetField>
          <WidgetField label="Service">
            <select>
              {services.slice(0, 8).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ₱{s.price.toLocaleString()}
                </option>
              ))}
            </select>
          </WidgetField>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <WidgetField label="Date">
            <input type="date" />
          </WidgetField>
          <WidgetField label="Preferred Time">
            <select>
              <option>Morning (9AM–12PM)</option>
              <option>Afternoon (12PM–5PM)</option>
              <option>Evening (5PM–9PM)</option>
            </select>
          </WidgetField>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <WidgetField label="Your Name">
            <input type="text" placeholder="Maria Santos" />
          </WidgetField>
          <WidgetField label="Phone Number">
            <input type="tel" placeholder="+63 XXX XXX XXXX" />
          </WidgetField>
        </div>

        <Link
          href="/book"
          style={{
            display: "block",
            width: "100%",
            padding: "14px 0",
            background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
            color: "var(--pw-forest-deep)",
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            textDecoration: "none",
            borderRadius: "var(--pw-radius)",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(201,169,110,0.35)",
          }}
        >
          Reserve My Session
        </Link>

        <p
          style={{
            fontSize: 11,
            color: "var(--pw-warm-light)",
            textAlign: "center",
            marginTop: 10,
          }}
        >
          Or{" "}
          <Link
            href="/book"
            style={{ color: "var(--pw-sage)", textDecoration: "none" }}
          >
            view full booking experience
          </Link>
        </p>
      </div>
    </div>
  );
}

function WidgetField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--pw-warm)",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
