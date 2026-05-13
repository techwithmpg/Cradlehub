"use client";

import { DispatchMockMap } from "./dispatch-mock-map";
import { DispatchDetailsPanel } from "./dispatch-details-panel";
import type { DispatchRole } from "./types";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

interface DispatchCityMapTabProps {
  role: DispatchRole;
  items: RealDispatchItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedItem: RealDispatchItem | null;
}

export function DispatchCityMapTab({ role, items, selectedId, onSelect, selectedItem }: DispatchCityMapTabProps) {
  const hasItems = items.length > 0;

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "minmax(0, 1fr) 280px",
        gap:                 "0.75rem",
        alignItems:          "start",
      }}
    >
      {/* Map area */}
      <div style={{ borderRadius: "var(--cs-r-md)", overflow: "hidden" }}>
        {hasItems ? (
          <DispatchMockMap variant="city" height={460} />
        ) : (
          <div
            style={{
              height:         460,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     "var(--cs-surface)",
              border:         "1px solid var(--cs-border-soft)",
              borderRadius:   "var(--cs-r-md)",
              color:          "var(--cs-text-subtle)",
              fontSize:       13,
            }}
          >
            No home-service dispatches for today.
          </div>
        )}
      </div>

      {/* Details panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Dispatch list for selection when no map clicking */}
        {items.length > 0 && (
          <div
            style={{
              background:    "var(--cs-surface)",
              border:        "1px solid var(--cs-border-soft)",
              borderRadius:  "var(--cs-r-md)",
              overflow:      "hidden",
              marginBottom:  "0.5rem",
            }}
          >
            <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--cs-border-soft)", fontSize: 11, fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Dispatches
            </div>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                style={{
                  width:        "100%",
                  textAlign:    "left",
                  padding:      "0.5rem 0.75rem",
                  background:   selectedId === item.id ? `${ACCENT}08` : "transparent",
                  borderLeft:   selectedId === item.id ? `3px solid ${ACCENT}` : "3px solid transparent",
                  borderTop:    "none",
                  borderRight:  "none",
                  borderBottom: "1px solid var(--cs-border-soft)",
                  cursor:       "pointer",
                  display:      "flex",
                  gap:          "0.5rem",
                  alignItems:   "baseline",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>{item.number}</span>
                <span style={{ fontSize: 12.5, color: "var(--cs-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.customerName}</span>
                <span style={{ fontSize: 11, color: "var(--cs-text-muted)", whiteSpace: "nowrap", marginLeft: "auto" }}>
                  {item.area ?? "—"}
                </span>
              </button>
            ))}
          </div>
        )}

        <DispatchDetailsPanel
          dispatch={selectedItem}
          role={role}
          onClose={undefined}
        />
      </div>
    </div>
  );
}

const ACCENT = "#6D28D9";
