/**
 * SpacesRulesAccessNotice
 *
 * Explains what CRM can and cannot configure in the Spaces & Booking Rules
 * workspace. Server component — no client state.
 *
 * Shown once near the top so CRM staff understand their edit scope before
 * interacting with the workspace.
 */

export function SpacesRulesAccessNotice() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        padding: "12px 16px",
        borderRadius: "var(--cs-r-sm,8px)",
        border: "1px solid rgba(41,128,185,0.2)",
        background: "rgba(41,128,185,0.04)",
        fontSize: "0.8125rem",
        color: "var(--cs-text-secondary)",
        lineHeight: 1.55,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🔧</span>
        <strong style={{ color: "var(--cs-info,#2980b9)", fontSize: "0.875rem" }}>
          MVP Setup Access
        </strong>
      </div>

      {/* Body */}
      <p style={{ margin: 0 }}>
        For now, CRM can manage practical operational setup so the system can be used immediately.
        Later, these controls can be tightened back to manager or owner-only access.
      </p>

      {/* Two columns: can / cannot */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.625rem",
          marginTop: "0.25rem",
        }}
      >
        {/* Can manage */}
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: "rgba(39,174,96,0.06)",
            border: "1px solid rgba(39,174,96,0.15)",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "var(--cs-success,#27ae60)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 6,
            }}
          >
            CRM can manage
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {[
              "Add / edit rooms and resources",
              "Toggle resource active/inactive",
              "Update resource capacity",
              "View booking rules (read-only)",
            ].map((item) => (
              <li key={item} style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)" }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Cannot manage */}
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: "rgba(230,126,34,0.04)",
            border: "1px solid rgba(230,126,34,0.15)",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "var(--cs-warning,#e67e22)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 6,
            }}
          >
            Requires manager / owner
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {[
              "Edit booking time windows",
              "Enable / disable home service",
              "Change max advance booking",
              "Finance or system-level settings",
            ].map((item) => (
              <li key={item} style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)" }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
