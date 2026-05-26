"use client";

import { useState } from "react";

type PageHelpDisclosureProps = {
  /** The button label shown when collapsed. */
  title?: string;
  /** Content to show when expanded. */
  children: React.ReactNode;
  /** Whether the section starts open. Defaults to false (closed). */
  defaultOpen?: boolean;
};

/**
 * PageHelpDisclosure
 *
 * A collapsible "How this page works" section.
 * Defaults to closed so it doesn't push main content down.
 * Keyboard-accessible with aria-expanded/aria-controls.
 *
 * @example
 * <PageHelpDisclosure title="How live availability works">
 *   <CheckInExplainer />
 * </PageHelpDisclosure>
 */
export function PageHelpDisclosure({
  title = "How this page works",
  children,
  defaultOpen = false,
}: PageHelpDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `help-disclosure-${title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;

  return (
    <div
      style={{
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md, 10px)",
        overflow: "hidden",
        background: "var(--cs-surface)",
      }}
    >
      {/* Toggle button */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.625rem 1rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "0.75rem" }}>ℹ️</span>
          {title}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {/* Expandable content */}
      <div
        id={id}
        role="region"
        aria-label={title}
        hidden={!open}
        style={{
          borderTop: open ? "1px solid var(--cs-border-soft)" : "none",
          padding: open ? "1rem" : 0,
        }}
      >
        {open && children}
      </div>
    </div>
  );
}
