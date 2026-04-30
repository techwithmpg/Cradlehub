import Link from "next/link";

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const bookingId = firstQueryValue(resolvedSearchParams.bookingId);
  const shortRef = bookingId ? bookingId.substring(0, 8).toUpperCase() : "—";

  return (
    <div style={{ textAlign: "center", padding: "2rem 0" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          backgroundColor: "var(--cs-sage-light)",
          border: "2px solid var(--cs-sage)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
          fontSize: 32,
          color: "var(--cs-sage)",
        }}
      >
        ✓
      </div>

      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--cs-text)",
          marginBottom: "0.5rem",
        }}
      >
        Booking confirmed!
      </h2>

      <p
        style={{
          fontSize: "1rem",
          color: "var(--cs-text-muted)",
          marginBottom: "1.5rem",
          lineHeight: 1.6,
        }}
      >
        Your appointment has been booked successfully.
        <br />
        We look forward to seeing you!
      </p>

      <div
        style={{
          display: "inline-block",
          padding: "0.625rem 1.25rem",
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 8,
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 2 }}>
          Booking reference
        </div>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--cs-text)",
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shortRef}
        </div>
      </div>

      <div
        style={{
          padding: "1rem 1.25rem",
          backgroundColor: "var(--cs-sand-lighter)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          marginBottom: "2rem",
          fontSize: "0.875rem",
          color: "var(--cs-text-muted)",
          lineHeight: 1.6,
        }}
      >
        Need to reschedule or cancel? Please contact us directly via{" "}
        <strong>Facebook Messenger</strong> or call your chosen branch.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <Link
          href="/book"
          style={{
            display: "block",
            padding: "11px 0",
            borderRadius: 8,
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            fontSize: "0.9375rem",
            fontWeight: 600,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          Book another appointment
        </Link>
        <Link
          href="/"
          style={{
            display: "block",
            padding: "11px 0",
            borderRadius: 8,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text-muted)",
            fontSize: "0.9375rem",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
