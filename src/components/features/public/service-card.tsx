import Link from "next/link";

export type ServiceCardProps = {
  category: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  branchId?: string;
  featured?: boolean;
};

function formatPrice(n: number) {
  if (n === 0) return "Contact us";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(n);
}

export function ServiceCard({
  category,
  name,
  description,
  durationMinutes,
  price,
  branchId,
  featured,
}: ServiceCardProps) {
  const bookHref = branchId ? `/book/${branchId}` : "/book";

  return (
    <div
      style={{
        background: "var(--pw-white)",
        border: featured
          ? "1.5px solid var(--pw-gold)"
          : "1px solid var(--pw-border)",
        borderRadius: "var(--pw-radius-lg)",
        padding: "24px 22px",
        display: "flex",
        flexDirection: "column",
        boxShadow: featured ? "var(--pw-shadow-md)" : "var(--pw-shadow-sm)",
        transition: `border-color var(--pw-duration) var(--pw-ease), box-shadow var(--pw-duration) var(--pw-ease)`,
        position: "relative",
      }}
    >
      {featured && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            padding: "3px 10px",
            background: "var(--pw-gold-light)",
            color: "#7A5A30",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderRadius: 100,
          }}
        >
          Most Loved
        </div>
      )}

      {/* Category */}
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--pw-sage)",
          marginBottom: 10,
        }}
      >
        {category}
      </div>

      {/* Name */}
      <h3
        style={{
          fontFamily: "var(--pw-font-display)",
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.2,
          color: "var(--pw-ink)",
          marginBottom: 10,
        }}
      >
        {name}
      </h3>

      {/* Description */}
      {description && (
        <p
          style={{
            fontSize: 13,
            color: "var(--pw-warm)",
            lineHeight: 1.6,
            flex: 1,
            marginBottom: 20,
          }}
        >
          {description}
        </p>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingTop: 18,
          borderTop: "1px solid var(--pw-border-light)",
          marginTop: "auto",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: 24,
              fontWeight: 300,
              color: "var(--pw-ink)",
              lineHeight: 1,
            }}
          >
            {formatPrice(price)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--pw-warm-light)",
              marginTop: 3,
            }}
          >
            {durationMinutes} minutes
          </div>
        </div>

        <Link
          href={bookHref}
          style={{
            padding: "9px 18px",
            border: "1px solid var(--pw-border)",
            color: "var(--pw-warm)",
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            textDecoration: "none",
            borderRadius: "var(--pw-radius)",
            transition: `all var(--pw-duration) var(--pw-ease)`,
          }}
        >
          Reserve
        </Link>
      </div>
    </div>
  );
}
