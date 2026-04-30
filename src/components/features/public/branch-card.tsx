import Link from "next/link";

export type BranchCardProps = {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  messengerLink?: string | null;
  mapsEmbedUrl?: string | null;
  badge?: string;
  hours?: string;
};

export function BranchCard({
  id,
  name,
  address,
  phone,
  email,
  messengerLink,
  mapsEmbedUrl,
  badge,
  hours,
}: BranchCardProps) {
  return (
    <div
      style={{
        background: "var(--pw-white)",
        borderRadius: "var(--pw-radius-lg)",
        border: "1px solid var(--pw-border)",
        overflow: "hidden",
        boxShadow: "var(--pw-shadow-sm)",
      }}
    >
      {/* Map or placeholder */}
      {mapsEmbedUrl ? (
        <iframe
          src={mapsEmbedUrl}
          width="100%"
          height="180"
          style={{ border: 0, display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Map — ${name}`}
        />
      ) : (
        <div
          style={{
            height: 180,
            background: "linear-gradient(135deg, var(--pw-forest-deep), var(--pw-forest))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: 24,
                fontWeight: 300,
                color: "var(--pw-cream)",
                letterSpacing: "0.08em",
              }}
            >
              {name}
            </div>
            {badge && (
              <div
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  padding: "4px 12px",
                  background: "rgba(201,169,110,0.15)",
                  border: "1px solid rgba(201,169,110,0.3)",
                  borderRadius: 100,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--pw-gold)",
                }}
              >
                {badge}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ padding: "22px 24px" }}>
        <h3
          style={{
            fontFamily: "var(--pw-font-display)",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--pw-ink)",
            marginBottom: 16,
          }}
        >
          {name}
        </h3>

        {[
          { label: "Address", value: address },
          phone ? { label: "Phone", value: phone } : null,
          email ? { label: "Email", value: email } : null,
          hours ? { label: "Hours", value: hours } : null,
        ]
          .filter(Boolean)
          .map((row) => (
            <div key={(row as { label: string }).label} style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--pw-sage)",
                  marginBottom: 2,
                }}
              >
                {(row as { label: string }).label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--pw-warm)",
                  lineHeight: 1.5,
                }}
              >
                {(row as { value: string }).value}
              </div>
            </div>
          ))}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <Link
            href={`/book/${id}`}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
              color: "var(--pw-forest-deep)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "var(--pw-radius)",
              textAlign: "center",
            }}
          >
            Book Here
          </Link>

          {messengerLink && (
            <a
              href={messengerLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "10px 0",
                background: "transparent",
                border: "1px solid var(--pw-border)",
                color: "var(--pw-warm)",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "none",
                borderRadius: "var(--pw-radius)",
                textAlign: "center",
              }}
            >
              Message
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
