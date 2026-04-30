import { StatCard } from "@/components/features/dashboard/stat-card";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { getOwnerDashboardAction, getOwnerBookingsAction } from "./bookings/actions";
import { getAllBranches } from "@/lib/queries/branches";
import { getAllStaff } from "@/lib/queries/staff";
import { formatCurrency, formatTime } from "@/lib/utils";
type BranchStat = { name: string; revenue: number; total: number; completed: number };

function today() { return new Date().toISOString().split("T")[0]!; }

export default async function OwnerOverviewPage() {
  const [stats, recentBookings, branches, staff] = await Promise.all([
    getOwnerDashboardAction(today()),
    getOwnerBookingsAction({ fromDate: today(), toDate: today() }),
    getAllBranches(),
    getAllStaff(),
  ]);

  const statsData = "error" in stats ? null : stats;
  const bookingsData = "error" in recentBookings ? [] : recentBookings;
  const activeStaff = staff.filter((s) => s.is_active).length;

  return (
    <div>
      {/* Workspace identity strip */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        padding:      "12px 14px",
        background:   "var(--cs-owner-bg)",
        border:       "1px solid rgba(122,90,138,0.15)",
        borderRadius: "var(--cs-r-md)",
        marginBottom: "1.25rem",
      }}>
        <div style={{
          width:          36,
          height:         36,
          borderRadius:   "var(--cs-r-sm)",
          background:     "rgba(122,90,138,0.15)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       18,
          flexShrink:     0,
        }}>
          ◆
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-owner-text)" }}>
            Owner&apos;s Suite
          </div>
          <div style={{ fontSize: 11.5, color: "var(--cs-text-muted)" }}>
            {new Date().toLocaleDateString("en-PH", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "0.875rem",
        marginBottom: "1.75rem",
      }}>
        <StatCard label="Today's Bookings" value={statsData?.total_bookings ?? 0} sub="all branches" accent accentColor="var(--cs-owner-accent)" />
        <StatCard label="Completed" value={statsData?.total_completed ?? 0} sub="today" trend="up" accentColor="var(--cs-owner-accent)" />
        <StatCard label="Today's Revenue" value={formatCurrency(statsData?.total_revenue ?? 0)} sub="completed sessions" accent accentColor="var(--cs-owner-accent)" />
        <StatCard label="Active Branches" value={branches.length} accentColor="var(--cs-owner-accent)" />
        <StatCard label="Team Members" value={activeStaff} sub="on roster" accentColor="var(--cs-owner-accent)" />
      </div>

      {/* Two-column layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: "1.25rem",
        alignItems: "start",
      }}>

        {/* Left: Today's bookings */}
        <div className="cs-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
              Today&apos;s Bookings
            </div>
            <span style={{
              marginLeft: "auto", fontSize: "0.75rem", fontWeight: 600,
              padding: "2px 8px", borderRadius: "var(--cs-r-pill)",
              backgroundColor: "var(--cs-sand-mist)", color: "var(--cs-sand)",
            }}>
              {bookingsData.length} total
            </span>
          </div>

          {bookingsData.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
              No bookings scheduled for today
            </div>
          ) : (
            <div>
              {bookingsData.map((b, i: number) => (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", gap: "0.875rem",
                  padding: "0.75rem 0",
                  borderBottom: i < bookingsData.length - 1 ? "1px solid var(--cs-border-soft)" : "none",
                }}>
                  <div style={{ minWidth: 52, fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-sand)" }}>
                    {formatTime(b.start_time)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {b.customers?.full_name ?? "—"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                      {b.services?.name} · {b.staff?.full_name} · {b.branches?.name}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <BookingTypeBadge type={b.type} />
                    <BookingStatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Branch performance + Quick Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
              <span style={{ fontSize: 16 }}>🏢</span>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
                Branch Performance
              </div>
            </div>
            {statsData?.by_branch?.map((b: BranchStat) => (
              <div key={b.name} style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--cs-border-soft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>{b.name}</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-sand)" }}>{formatCurrency(b.revenue)}</span>
                </div>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                  <span>{b.total} bookings</span>
                  <span>{b.completed} completed</span>
                </div>
                <div style={{ height: 3, backgroundColor: "var(--cs-border)", borderRadius: 2, marginTop: 6 }}>
                  <div style={{
                    height: "100%",
                    width: `${b.total > 0 ? Math.round(b.completed / b.total * 100) : 0}%`,
                    backgroundColor: "var(--cs-success)",
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.875rem" }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
                Quick Actions
              </div>
            </div>
            {[
              { icon: "👥", label: "Invite staff member", href: "/owner/staff/new" },
              { icon: "✨", label: "Add new service", href: "/owner/services/new" },
              { icon: "🏢", label: "Manage branches", href: "/owner/branches" },
              { icon: "📊", label: "View all bookings", href: "/owner/bookings" },
            ].map(action => (
              <a key={action.href} href={action.href} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "0.625rem 0.5rem",
                borderRadius: "var(--cs-r-sm)",
                textDecoration: "none",
                color: "var(--cs-text-secondary)",
                fontSize: "0.8125rem",
                transition: "var(--cs-trans)",
              }}>
                <span>{action.icon}</span>
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

