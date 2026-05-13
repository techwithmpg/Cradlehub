"use client";

import { CalendarDays, Clock, Car, CheckCircle, MoreHorizontal } from "lucide-react";
import { DispatchStatsCards } from "./dispatch-stats-cards";
import { DispatchStatusBadge } from "./dispatch-status-badge";
import { DispatchDetailsPanel } from "./dispatch-details-panel";
import type { DispatchRole } from "./types";
import type { RealDispatchItem, DispatchStats } from "@/lib/queries/dispatch-queries";

const ACCENT = "#6D28D9";

interface DispatchQueueTabProps {
  role: DispatchRole;
  items: RealDispatchItem[];
  stats: DispatchStats;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedItem: RealDispatchItem | null;
}

export function DispatchQueueTab({
  role,
  items,
  stats,
  selectedId,
  onSelect,
  selectedItem,
}: DispatchQueueTabProps) {
  const queueStats = [
    { label: "Today's Home Services", value: stats.totalToday,      icon: <CalendarDays size={14} />, accentColor: ACCENT },
    { label: "Awaiting Dispatch",     value: stats.awaitingDispatch, icon: <Clock size={14} />,        accentColor: "#B45309" },
    { label: "Active Trips",          value: stats.activeTrips,      icon: <Car size={14} />,          accentColor: "#2563EB" },
    { label: "Completed Today",       value: stats.completedToday,   icon: <CheckCircle size={14} />,  accentColor: "#16A34A" },
  ];

  return (
    <div>
      <DispatchStatsCards stats={queueStats} />

      {items.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--cs-text-subtle)", fontSize: 13 }}>
          No home-service dispatches for today.
        </div>
      ) : (
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "minmax(0, 1fr) 280px",
            gap:                 "0.75rem",
            alignItems:          "start",
          }}
        >
          {/* Queue table */}
          <div
            className="cs-table-wrap"
            style={{
              background:   "var(--cs-surface)",
              border:       "1px solid var(--cs-border-soft)",
              borderRadius: "var(--cs-r-md)",
              overflow:     "hidden",
            }}
          >
            <table className="cs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Dispatch #", "Customer", "Service", "Driver", "Therapist", "Status", "ETA", "Action"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding:       "0.625rem 0.875rem",
                        textAlign:     "left",
                        fontSize:      10.5,
                        fontWeight:    500,
                        color:         "var(--cs-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        borderBottom:  "1.5px solid var(--cs-border-soft)",
                        whiteSpace:    "nowrap",
                        background:    "var(--cs-surface-warm, #FAF8F5)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    isSelected={selectedId === item.id}
                    onSelect={() => onSelect(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Details panel */}
          <DispatchDetailsPanel
            dispatch={selectedItem}
            role={role}
            onClose={() => onSelect(null)}
          />
        </div>
      )}
    </div>
  );
}

function QueueRow({
  item,
  isSelected,
  onSelect,
}: {
  item: RealDispatchItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      style={{
        cursor:     "pointer",
        background: isSelected ? `${ACCENT}08` : "transparent",
        borderLeft: isSelected ? `3px solid ${ACCENT}` : "3px solid transparent",
        transition: "background 0.15s",
      }}
    >
      <td style={tdStyle}>
        <span style={{ fontWeight: 700, color: ACCENT, fontSize: 13 }}>{item.number}</span>
      </td>
      <td style={tdStyle}>{item.customerName}</td>
      <td style={tdStyle}>{item.serviceName}</td>
      <td style={tdStyle}>
        {item.driverName ?? <span style={{ color: "var(--cs-text-subtle)" }}>—</span>}
      </td>
      <td style={tdStyle}>
        {item.therapistName ?? <span style={{ color: "var(--cs-text-subtle)" }}>—</span>}
      </td>
      <td style={tdStyle}>
        <DispatchStatusBadge status={item.dispatchStatus} />
      </td>
      <td style={tdStyle}>
        {item.etaMinutes !== null
          ? <span style={{ fontWeight: 600 }}>{item.etaMinutes} min</span>
          : <span style={{ color: "var(--cs-text-subtle)" }}>—</span>}
      </td>
      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
        <button
          aria-label={`Actions for dispatch ${item.number}`}
          style={{
            background:   "none",
            border:       "1px solid var(--cs-border-soft)",
            borderRadius: "var(--cs-r-xs)",
            padding:      "3px 6px",
            cursor:       "pointer",
            color:        "var(--cs-text-muted)",
            display:      "flex",
            alignItems:   "center",
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding:      "0.625rem 0.875rem",
  fontSize:     13,
  color:        "var(--cs-text)",
  borderBottom: "1px solid var(--cs-border-soft)",
  whiteSpace:   "nowrap",
};
