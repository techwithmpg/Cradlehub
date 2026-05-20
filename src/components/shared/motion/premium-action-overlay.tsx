"use client";

type PremiumActionOverlayProps = {
  open: boolean;
  title: string;
  description?: string;
};

export function PremiumActionOverlay({ open, title, description }: PremiumActionOverlayProps) {
  if (!open) return null;

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(247, 242, 232, 0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          padding: "2rem 2.5rem",
          maxWidth: 300,
          width: "calc(100% - 2rem)",
          textAlign: "center",
          borderRadius: 24,
          backgroundColor: "rgba(255,255,255,0.92)",
          boxShadow:
            "0 20px 60px rgba(30,25,22,0.15), 0 4px 16px rgba(30,25,22,0.08)",
          border: "1px solid rgba(255,255,255,0.7)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {/* Forest green spinner */}
        <span
          className="animate-spin"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "3px solid var(--cs-success-bg)",
            borderTopColor: "var(--cs-success)",
            display: "inline-block",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--cs-text)",
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                fontSize: 12,
                color: "var(--cs-text-muted)",
                lineHeight: 1.5,
              }}
            >
              {description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
