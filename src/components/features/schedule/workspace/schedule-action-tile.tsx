"use client";

import Link from "next/link";

export function ScheduleActionTile({
  label,
  icon,
  href,
  onClick,
  primary = false,
}: {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    padding: "0.625rem 0.875rem",
    borderRadius: "var(--cs-r-md)",
    background: primary ? "var(--cs-crm-accent)" : "var(--cs-surface-warm)",
    color: primary ? "#fff" : "var(--cs-text-secondary)",
    border: primary ? "none" : "1px solid var(--cs-border-soft)",
    fontSize: "0.8125rem",
    fontWeight: 500,
    cursor: href || onClick ? "pointer" : "default",
    textDecoration: "none",
    transition: "box-shadow 150ms ease, transform 150ms ease",
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (href || onClick) {
      e.currentTarget.style.boxShadow = "var(--cs-shadow-xs)";
      e.currentTarget.style.transform = "translateY(-0.5px)";
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.transform = "none";
  };

  const children = (
    <>
      {icon && <span style={{ display: "inline-flex", alignItems: "center", opacity: 0.85 }}>{icon}</span>}
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={style} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={style} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {children}
      </button>
    );
  }

  return (
    <div style={style} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
    </div>
  );
}
