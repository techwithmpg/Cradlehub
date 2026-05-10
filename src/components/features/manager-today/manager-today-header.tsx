"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalkinDialog } from "./walkin-dialog";

export function ManagerTodayHeader({
  branchName,
  todayLabel,
}: {
  branchName: string;
  todayLabel: string;
}) {
  const [walkinOpen, setWalkinOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
        marginBottom: "1.25rem",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.375rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Manager Today
          </h1>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 20,
              backgroundColor: "var(--cs-surface-warm)",
              border: "1px solid var(--cs-border)",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
            }}
          >
            <Lock size={12} />
            {branchName}
          </span>
        </div>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--cs-text-muted)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Your daily control center for branch operations · {todayLabel}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWalkinOpen(true)}
          style={{
            height: 36,
            gap: 6,
            borderColor: "var(--cs-border)",
            color: "var(--cs-text)",
            backgroundColor: "var(--cs-surface)",
          }}
        >
          <Plus size={14} />
          Walk-in
        </Button>
        <Button
          size="sm"
          asChild
          style={{
            height: 36,
            gap: 6,
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
          }}
        >
          <Link href="/crm/bookings/new">
            <Calendar size={14} />
            New Booking
          </Link>
        </Button>
      </div>

      <WalkinDialog open={walkinOpen} onOpenChange={setWalkinOpen} />
    </div>
  );
}
