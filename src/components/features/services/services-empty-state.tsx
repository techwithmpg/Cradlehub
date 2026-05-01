"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

type Props = {
  hasFilters: boolean;
  onClearFilters?: () => void;
};

export function ServicesEmptyState({ hasFilters, onClearFilters }: Props) {
  if (hasFilters) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "3rem 1.5rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          No services found
        </div>
        <div style={{ fontSize: "0.875rem", marginBottom: 16 }}>
          Try adjusting your search or filters.
        </div>
        {onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="cs-btn cs-btn-ghost cs-btn-sm"
          >
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="cs-card"
      style={{
        padding: "3rem 1.5rem",
        textAlign: "center",
        color: "var(--cs-text-muted)",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 12 }}>
        <Sparkles className="h-8 w-8 mx-auto" style={{ color: "var(--cs-sand)" }} />
      </div>
      <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
        No services yet
      </div>
      <div style={{ fontSize: "0.875rem", marginBottom: 16 }}>
        Create your first spa service to start accepting bookings.
      </div>
      <Button
        asChild
        size="sm"
        style={{
          backgroundColor: "var(--cs-sand)",
          color: "#fff",
          border: "none",
        }}
      >
        <Link href="/owner/services/new">+ New Service</Link>
      </Button>
    </div>
  );
}
