"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const PRESETS = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "last7" },
  { label: "Last 30 Days", value: "last30" },
  { label: "This Month", value: "thisMonth" },
];

export function ReportDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPreset = searchParams.get("preset") || "last7";
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handlePresetChange = (preset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", preset);
    // Reset custom dates if preset is selected
    params.delete("from");
    params.delete("to");
    router.push(`/owner/reports?${params.toString()}`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {PRESETS.map((preset) => {
          const isActive = currentPreset === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => handlePresetChange(preset.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "var(--cs-r-pill)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                border: "1px solid",
                borderColor: isActive ? "var(--cs-sand)" : "var(--cs-border-soft)",
                backgroundColor: isActive ? "var(--cs-sand)" : "transparent",
                color: isActive ? "white" : "var(--cs-text-muted)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.875rem",
            backgroundColor: "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
            borderRadius: "var(--cs-r-md)",
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
          }}
        >
          <Calendar size={14} />
          <span>
            {searchParams.get("from") && searchParams.get("to")
              ? `${searchParams.get("from")} - ${searchParams.get("to")}`
              : "Auto-range based on preset"}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
          style={{ height: 36, borderRadius: "var(--cs-r-md)" }}
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
