import Link from "next/link";

type BranchCardProps = {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  messengerLink?: string | null;
  mapsEmbedUrl?: string | null;
};

export function BranchCard({
  id,
  name,
  address,
  phone,
  messengerLink,
  mapsEmbedUrl,
}: BranchCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--ch-surface)",
        border: "1px solid var(--ch-border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {mapsEmbedUrl ? (
        <iframe
          src={mapsEmbedUrl}
          width="100%"
          height="200"
          style={{ border: 0, display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Map for ${name}`}
        />
      ) : (
        <div
          style={{
            height: 200,
            backgroundColor: "var(--ch-page-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.875rem",
            color: "var(--ch-text-subtle)",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          MAP
        </div>
      )}

      <div style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "1.0625rem",
            fontWeight: 600,
            color: "var(--ch-text)",
            marginBottom: "0.375rem",
          }}
        >
          {name}
        </div>

        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--ch-text-muted)",
            marginBottom: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          {address}
        </div>

        {phone && (
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--ch-text-muted)",
              marginBottom: "0.875rem",
            }}
          >
            📞 {phone}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
          <Link
            href={`/book/${id}`}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 7,
              backgroundColor: "var(--ch-accent)",
              color: "var(--ch-surface)",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Book here
          </Link>

          {messengerLink && (
            <a
              href={messengerLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 7,
                border: "1px solid var(--ch-border)",
                backgroundColor: "var(--ch-surface)",
                color: "var(--ch-text-muted)",
                fontSize: "0.875rem",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Message us
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
