import { redirect }     from "next/navigation";
import { PageHeader }   from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";

const ALLOWED_ROLES = ["owner", "manager", "crm", "csr_head"];

type Resource = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  notes: string | null;
  is_active: boolean;
};

type BookingSlot = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  customer_name: string | null;
  service_name:  string | null;
  staff_name:    string | null;
};

type ResourceUtilization = {
  resource: Resource;
  slots: BookingSlot[];
  usedMins: number;
  availableMins: number;
  utilizationPct: number;
};

const OPEN_HOUR  = 8;
const CLOSE_HOUR = 22;
const TOTAL_MINS = (CLOSE_HOUR - OPEN_HOUR) * 60;

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
}

function pctBarColor(pct: number): string {
  if (pct >= 80) return "#EF4444";
  if (pct >= 50) return "var(--cs-sand)";
  return "var(--cs-success)";
}

const TYPE_ICON: Record<string, string> = {
  room: "🚪", bed: "🛌", chair: "🪑",
  equipment: "⚙️", home_service_unit: "🚗", shared_area: "👥",
};

async function getManagerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { supabase, branchId: mock.branch_id as string, branchName: mock.branches.name as string };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !ALLOWED_ROLES.includes(me.system_role) || !me.branch_id) redirect("/login");

  return {
    supabase,
    branchId:   me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
  };
}

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, branchId, branchName } = await getManagerContext();
  const { date: qDate } = await searchParams;
  const today = new Date().toISOString().split("T")[0]!;
  const selectedDate = qDate ?? today;

  const [resourcesRes, bookingsRes] = await Promise.all([
    supabase
      .from("branch_resources")
      .select("id, name, type, capacity, notes, is_active")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),

    supabase
      .from("bookings")
      .select(`
        id, start_time, end_time, status, type, resource_id,
        customers ( full_name ),
        services  ( name ),
        staff     ( full_name )
      `)
      .eq("branch_id", branchId)
      .eq("booking_date", selectedDate)
      .not("status", "in", '("cancelled","no_show")')
      .not("resource_id", "is", null)
      .order("start_time"),
  ]);

  const resources = (resourcesRes.data ?? []) as Resource[];
  const bookings = (bookingsRes.data ?? []) as Array<{
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    type: string;
    resource_id: string | null;
    customers: { full_name: string } | { full_name: string }[] | null;
    services:  { name: string }      | { name: string }[]      | null;
    staff:     { full_name: string } | { full_name: string }[] | null;
  }>;

  function firstRel<T>(v: T | T[] | null): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  // Build utilization per resource
  const byResource = new Map<string, BookingSlot[]>();
  for (const b of bookings) {
    if (!b.resource_id) continue;
    if (!byResource.has(b.resource_id)) byResource.set(b.resource_id, []);
    byResource.get(b.resource_id)!.push({
      id:            b.id,
      start_time:    b.start_time,
      end_time:      b.end_time,
      status:        b.status,
      type:          b.type,
      customer_name: firstRel(b.customers)?.full_name ?? null,
      service_name:  firstRel(b.services)?.name       ?? null,
      staff_name:    firstRel(b.staff)?.full_name      ?? null,
    });
  }

  const utilization: ResourceUtilization[] = resources.map((res) => {
    const slots = byResource.get(res.id) ?? [];
    const usedMins = slots.reduce((sum, s) => {
      const start = Math.max(toMins(s.start_time), OPEN_HOUR * 60);
      const end   = Math.min(toMins(s.end_time),   CLOSE_HOUR * 60);
      return sum + Math.max(0, end - start);
    }, 0);
    const pct = Math.min(100, Math.round((usedMins / TOTAL_MINS) * 100));
    return { resource: res, slots, usedMins, availableMins: TOTAL_MINS - usedMins, utilizationPct: pct };
  });

  const totalUsed = utilization.reduce((s, u) => s + u.usedMins, 0);
  const totalAvail = utilization.length * TOTAL_MINS;
  const overallPct = totalAvail > 0 ? Math.round((totalUsed / totalAvail) * 100) : 0;
  const highlyUtilized = utilization.filter((u) => u.utilizationPct >= 80).length;
  const unassignedCount = bookings.filter((b) => !b.resource_id).length;

  return (
    <div>
      <PageHeader
        title="Space Utilization"
        description={`${branchName} · Track room and bed usage for your branch`}
        icon="🏠"
      />

      {/* Date picker + summary KPIs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <form method="GET">
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            style={{
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--cs-border)",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text)",
              padding: "0 0.75rem",
              fontSize: "0.875rem",
            }}
            onChange={(e) => {
              const form = (e.target as HTMLInputElement).form;
              if (form) form.submit();
            }}
          />
        </form>

        {selectedDate === today ? (
          <span style={{ fontSize: "0.8125rem", color: "var(--cs-sand)", fontWeight: 600 }}>Today</span>
        ) : (
          <a
            href="/manager/resources"
            style={{
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Back to Today
          </a>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            { label: "Spaces",   value: resources.length },
            { label: "Overall",  value: `${overallPct}%` },
            { label: "High Use", value: highlyUtilized },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: 8,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--cs-text)" }}>{kpi.value}</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {resources.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏠</div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>No spaces defined</div>
          <div style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>
            Add rooms, beds, or equipment in Owner → Branches → {branchName}.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {utilization.map(({ resource, slots, usedMins, availableMins, utilizationPct }) => (
            <div
              key={resource.id}
              className="cs-card"
              style={{ padding: "1.25rem" }}
            >
              {/* Resource header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: "var(--cs-surface-warm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.25rem",
                    }}
                  >
                    {TYPE_ICON[resource.type] ?? "📦"}
                  </div>
                  <div>
                    <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--cs-text)" }}>
                      {resource.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", textTransform: "capitalize" }}>
                      {resource.type.replace(/_/g, " ")}
                      {resource.capacity > 1 ? ` · Cap: ${resource.capacity}` : ""}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: pctBarColor(utilizationPct), lineHeight: 1 }}>
                    {utilizationPct}%
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                    {Math.round(usedMins / 60)}h used · {Math.round(availableMins / 60)}h free
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "var(--cs-border)",
                  marginBottom: slots.length > 0 ? "1rem" : 0,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    width: `${utilizationPct}%`,
                    backgroundColor: pctBarColor(utilizationPct),
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {/* Booking slots */}
              {slots.length === 0 ? (
                <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
                  No bookings assigned for this date.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        borderRadius: 8,
                        backgroundColor: "var(--cs-surface-warm)",
                        border: "1px solid var(--cs-border)",
                      }}
                    >
                      <div style={{ minWidth: 90, fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap" }}>
                        {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {slot.customer_name ?? "—"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {slot.service_name ?? "Service"}
                          {slot.staff_name && <span style={{ marginLeft: 5 }}>· {slot.staff_name}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {slot.type === "home_service" && (
                          <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "2px 5px", borderRadius: 3, backgroundColor: "#FFF7ED", color: "#92400E", textTransform: "uppercase" }}>
                            Home
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: 3,
                            textTransform: "uppercase",
                            backgroundColor:
                              slot.status === "in_progress" ? "#FFF7ED"
                              : slot.status === "completed"  ? "#ECFDF5"
                              : "var(--cs-sand-mist)",
                            color:
                              slot.status === "in_progress" ? "#92400E"
                              : slot.status === "completed"  ? "#065F46"
                              : "var(--cs-sand)",
                          }}
                        >
                          {slot.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {unassignedCount > 0 && (
            <div
              style={{
                padding: "0.875rem 1.25rem",
                borderRadius: 10,
                border: "1px dashed var(--cs-border)",
                backgroundColor: "var(--cs-surface-warm)",
                color: "var(--cs-text-muted)",
                fontSize: "0.8125rem",
              }}
            >
              ⚠️ {unassignedCount} booking{unassignedCount !== 1 ? "s" : ""} on this date have no space assigned.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
