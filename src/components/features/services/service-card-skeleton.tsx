export function ServiceCardSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: "var(--cs-r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Image skeleton */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          backgroundColor: "var(--cs-bg)",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />

      <div style={{ padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Title skeleton */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
          <div
            style={{
              height: 18,
              width: "60%",
              borderRadius: 4,
              backgroundColor: "var(--cs-bg)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <div
            style={{
              height: 18,
              width: 50,
              borderRadius: 100,
              backgroundColor: "var(--cs-bg)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>

        {/* Description skeleton */}
        <div
          style={{
            height: 14,
            width: "90%",
            borderRadius: 4,
            backgroundColor: "var(--cs-bg)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div
          style={{
            height: 14,
            width: "70%",
            borderRadius: 4,
            backgroundColor: "var(--cs-bg)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />

        {/* Badge skeleton */}
        <div
          style={{
            height: 20,
            width: 80,
            borderRadius: 100,
            backgroundColor: "var(--cs-bg)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />

        {/* Stats skeleton */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            padding: "0.625rem",
            borderRadius: "var(--cs-r-md)",
            backgroundColor: "var(--cs-bg)",
          }}
        >
          <div
            style={{
              height: 14,
              width: "50%",
              borderRadius: 4,
              backgroundColor: "var(--cs-surface)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <div
            style={{
              height: 14,
              width: "50%",
              borderRadius: 4,
              backgroundColor: "var(--cs-surface)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              marginLeft: "auto",
            }}
          />
        </div>

        {/* Toggle skeleton */}
        <div
          style={{
            height: 36,
            borderRadius: "var(--cs-r-md)",
            backgroundColor: "var(--cs-bg)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />

        {/* Actions skeleton */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--cs-border-soft)",
          }}
        >
          <div
            style={{
              height: 28,
              width: 60,
              borderRadius: 4,
              backgroundColor: "var(--cs-bg)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <div
            style={{
              height: 28,
              width: 32,
              borderRadius: 4,
              backgroundColor: "var(--cs-bg)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
