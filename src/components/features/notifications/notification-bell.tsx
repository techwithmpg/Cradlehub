"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUnreadCountAction } from "@/lib/notifications/queries";

const WORKSPACE_HREF: Record<string, string> = {
  owner:     "/owner/notifications",
  manager:   "/manager/notifications",
  crm:       "/crm/notifications",
  csr_head:  "/crm/notifications",
  csr_staff: "/crm/notifications",
  csr:       "/crm/notifications",
  staff:     "/staff-portal/notifications",
  driver:    "/driver/notifications",
  utility:   "/utility/notifications",
};

export function NotificationBell({ role }: { role: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getUnreadCountAction().then(setCount).catch(() => {});
  }, []);

  const href = WORKSPACE_HREF[role] ?? "/owner/notifications";

  return (
    <Link
      href={href}
      title={count > 0 ? `${count} unread notification${count === 1 ? "" : "s"}` : "Notifications"}
      style={{
        position:       "relative",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        width:          30,
        height:         30,
        borderRadius:   "var(--cs-r-xs)",
        color:          count > 0 ? "var(--cs-text)" : "var(--cs-text-muted)",
        textDecoration: "none",
        flexShrink:     0,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {count > 0 && (
        <span style={{
          position:       "absolute",
          top:            1,
          right:          1,
          background:     "#ef4444",
          color:          "#fff",
          borderRadius:   "9999px",
          fontSize:       9,
          fontWeight:     700,
          minWidth:       14,
          height:         14,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "0 3px",
          lineHeight:     1,
          letterSpacing:  "0.02em",
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
