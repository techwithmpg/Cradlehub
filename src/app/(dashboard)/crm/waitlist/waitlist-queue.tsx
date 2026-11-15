"use client";

import { useState, useTransition } from "react";
import { Building2, Calendar, Home, Mail, Phone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import { CrmInfoCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import { updateWaitlistStatusAction } from "./actions";

type WaitlistRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  visit_type: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  services: { name: string } | { name: string }[] | null;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  waiting:   { bg: "var(--cs-sand-mist)", color: "var(--cs-sand)" },
  contacted: { bg: "#EFF6FF",             color: "#1D4ED8" },
  converted: { bg: "#ECFDF5",             color: "#065F46" },
  expired:   { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" },
  cancelled: { bg: "#FEF2F2",             color: "#991B1B" },
};

const TABS = ["waiting", "contacted", "converted", "expired", "cancelled"] as const;
type TabKey = typeof TABS[number];

function first<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function StatusButton({
  requestId,
  current,
  target,
  label,
}: {
  requestId: string;
  current: string;
  target: TabKey;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  const STATUS_LABELS: Record<string, string> = {
    contacted: "Marked as contacted.",
    converted: "Customer converted.",
    expired:   "Request expired.",
    cancelled: "Request cancelled.",
    waiting:   "Moved back to waiting.",
  };

  function handleClick() {
    startTransition(async () => {
      const result = await updateWaitlistStatusAction({ requestId, status: target });
      if (result.ok) {
        toast.success(STATUS_LABELS[target] ?? "Waitlist updated.");
      } else {
        toast.error(result.error ?? "Could not update waitlist request.");
      }
    });
  }

  if (current === target) return null;

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      style={{
        padding: "3px 8px",
        borderRadius: 4,
        border: "1px solid var(--cs-border)",
        backgroundColor: "transparent",
        fontSize: "0.6875rem",
        fontWeight: 600,
        color: "var(--cs-text-muted)",
        cursor: isPending ? "default" : "pointer",
        opacity: isPending ? 0.5 : 1,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </button>
  );
}

export function WaitlistQueue({
  initialRows,
}: {
  initialRows: WaitlistRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("waiting");

  const filtered = initialRows.filter((r) => r.status === activeTab);
  const counts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t] = initialRows.filter((r) => r.status === t).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: "1rem", flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
              borderColor: activeTab === tab ? "var(--cs-sand)" : "var(--cs-border)",
              backgroundColor: activeTab === tab ? "var(--cs-sand-mist)" : "transparent",
              color: activeTab === tab ? "var(--cs-sand)" : "var(--cs-text-muted)",
            }}
          >
            {tab}
            {counts[tab]! > 0 && (
              <span style={{ marginLeft: 5, opacity: 0.75, fontSize: "0.6875rem", fontWeight: 700 }}>
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          No {activeTab} requests.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map((row) => {
            const svc = first(row.services);
            const style = STATUS_STYLE[row.status] ?? STATUS_STYLE["waiting"]!;
            const cardTone: CrmCardTone =
              row.status === "waiting"
                ? "warning"
                : row.status === "contacted"
                  ? "info"
                  : row.status === "converted"
                    ? "success"
                    : row.status === "cancelled"
                      ? "danger"
                      : "neutral";

            return (
              <CrmInfoCard
                key={row.id}
                tone={cardTone}
                compact
                title={row.customer_name}
                badge={
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-bold capitalize"
                    style={style}
                  >
                    {row.status}
                  </span>
                }
                subtitle={
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3.5" aria-hidden />
                      {row.customer_phone}
                    </span>
                    {row.customer_email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3.5" aria-hidden />
                        {row.customer_email}
                      </span>
                    ) : null}
                  </div>
                }
                actions={
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[11px] text-[var(--cs-text-muted)]">
                      {new Date(row.created_at).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {row.status === "waiting" && (
                        <>
                          <OpenAdministrativeBookingButton
                            mode={row.visit_type === "home_service" ? "home_service" : "standard_future"}
                            name={row.customer_name}
                            phone={row.customer_phone}
                            date={row.preferred_date ?? undefined}
                            time={row.preferred_time?.slice(0, 5)}
                            showIcon={false}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              border: "none",
                              backgroundColor: "#0D5C43",
                              color: "#fff",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              textDecoration: "none",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Book Now
                          </OpenAdministrativeBookingButton>
                          <StatusButton requestId={row.id} current={row.status} target="contacted" label="Mark Contacted" />
                          <StatusButton requestId={row.id} current={row.status} target="expired" label="Expire" />
                        </>
                      )}
                      {row.status === "contacted" && (
                        <>
                          <OpenAdministrativeBookingButton
                            mode={row.visit_type === "home_service" ? "home_service" : "standard_future"}
                            name={row.customer_name}
                            phone={row.customer_phone}
                            date={row.preferred_date ?? undefined}
                            time={row.preferred_time?.slice(0, 5)}
                            showIcon={false}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              border: "none",
                              backgroundColor: "var(--cs-sand)",
                              color: "#fff",
                              fontSize: "0.6875rem",
                              fontWeight: 600,
                              textDecoration: "none",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Book
                          </OpenAdministrativeBookingButton>
                          <StatusButton requestId={row.id} current={row.status} target="converted" label="Mark Converted" />
                          <StatusButton requestId={row.id} current={row.status} target="expired" label="Expire" />
                        </>
                      )}
                      {(row.status === "waiting" || row.status === "contacted") && (
                        <StatusButton requestId={row.id} current={row.status} target="cancelled" label="Cancel" />
                      )}
                    </div>
                  </div>
                }
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--cs-text-secondary)]">
                  {row.preferred_date ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3.5 text-[var(--cs-text-muted)]" aria-hidden />
                      {new Date(row.preferred_date + "T00:00:00").toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                      {row.preferred_time && ` ${row.preferred_time.substring(0, 5)}`}
                    </span>
                  ) : null}
                  {svc ? (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3.5 text-[var(--cs-text-muted)]" aria-hidden />
                      {svc.name}
                    </span>
                  ) : null}
                  {row.visit_type ? (
                    <span className="inline-flex items-center gap-1">
                      {row.visit_type === "home_service" ? (
                        <Home className="size-3.5 text-[var(--cs-text-muted)]" aria-hidden />
                      ) : (
                        <Building2 className="size-3.5 text-[var(--cs-text-muted)]" aria-hidden />
                      )}
                      {row.visit_type === "home_service" ? "Home" : "In-Spa"}
                    </span>
                  ) : null}
                </div>
                {row.notes ? (
                  <p className="mt-1.5 text-xs italic text-[var(--cs-text-muted)]">
                    &ldquo;{row.notes}&rdquo;
                  </p>
                ) : null}
              </CrmInfoCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

