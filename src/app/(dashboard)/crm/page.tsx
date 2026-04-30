import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { CustomerSearch } from "@/components/features/dashboard/customer-search";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { CustomerSegmentBadge } from "@/components/features/crm/customer-segment-badge";
import { getAllCustomers, getCrmStats } from "@/lib/queries/customers";
import { formatDate } from "@/lib/utils";
type CustomerListItem = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  total_bookings: number;
  last_booking_date: string | null;
  first_booking_date: string | null;
  preferred_staff_id: string | null;
  notes: string | null;
  staff?: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function computeSegment(customer: CustomerListItem): "new" | "repeat" | "lapsed" | null {
  if (customer.total_bookings === 1) return "new";
  if (customer.total_bookings >= 2) {
    if (customer.last_booking_date) {
      const daysSince = Math.floor(
        (Date.now() - new Date(customer.last_booking_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince >= 30) return "lapsed";
    }
    return "repeat";
  }
  return null;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const TAB_ITEMS = [
  { href: "/crm", label: "All Customers" },
  { href: "/crm/repeats", label: "Repeat Clients" },
  { href: "/crm/lapsed", label: "Lapsed Clients" },
];

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageParam = Number(resolvedSearchParams.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const [stats, { customers, total }] = await Promise.all([
    getCrmStats(),
    getAllCustomers(page, 25),
  ]);

  const rows = customers as unknown as CustomerListItem[];
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <PageHeader
        title="CRM Hub"
        description="Guest relationships, visit history, repeat clients, and follow-up opportunities."
        icon="🤝"
      />

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "0.625rem",
          marginBottom: "1rem",
        }}
      >
        <StatCard label="Total Customers" value={stats.total} accent />
        <StatCard label="Repeat Clients" value={stats.repeat} />
        <StatCard label="Lapsed Clients" value={stats.lapsed} />
        <StatCard label="New This Month" value={stats.newThisMonth} />
        <StatCard label="Total Visits" value={stats.totalVisits} accent />
      </div>

      {/* Front Desk Quick Actions */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/manager/walkin"
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          ➕ Walk-in Booking
        </Link>
        <Link
          href="/manager/bookings"
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          📋 Today&apos;s Bookings
        </Link>
        <Link
          href="/crm"
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          🔍 Search Customers
        </Link>
      </div>

      {/* Segments */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <Link
          href="/crm"
          className="cs-card"
          style={{
            padding: "1rem",
            textDecoration: "none",
            color: "var(--cs-text)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "var(--cs-sage-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            🌱
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>New Guests</div>
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
              1 booking &middot; First visit
            </div>
          </div>
        </Link>

        <Link
          href="/crm/repeats"
          className="cs-card"
          style={{
            padding: "1rem",
            textDecoration: "none",
            color: "var(--cs-text)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "var(--cs-sand-lighter)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            💛
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Repeat Clients</div>
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
              2+ bookings &middot; Loyal guests
            </div>
          </div>
        </Link>

        <Link
          href="/crm/lapsed"
          className="cs-card"
          style={{
            padding: "1rem",
            textDecoration: "none",
            color: "var(--cs-text)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            🔔
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Lapsed Clients</div>
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
              30+ days since last visit
            </div>
          </div>
        </Link>

        <div
          className="cs-card"
          style={{
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            opacity: 0.65,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "#F3E8FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            💎
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text-muted)" }}>
              VIP / High Value
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Coming soon</div>
          </div>
        </div>
      </div>

      {/* Search + Tabs */}
      <div style={{ marginBottom: "1.25rem" }}>
        <CustomerSearch />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {TAB_ITEMS.map((tab) => {
          const isActive = tab.href === "/crm"; // exact match since this is /crm page
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: isActive ? "var(--cs-sand-lighter)" : "var(--cs-surface)",
                color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
                fontSize: "0.8125rem",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <CrmEmptyState />
      ) : (
        <>
          <div
            style={{
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {rows.map((customer, i) => {
              const segment = computeSegment(customer);
              const preferredStaff = firstRelation(customer.staff);
              const ds = daysSince(customer.last_booking_date);

              return (
                <div
                  key={customer.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.875rem",
                    padding: "0.875rem 1rem",
                    borderBottom: i < rows.length - 1 ? "1px solid var(--cs-border)" : "none",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      backgroundColor: "var(--cs-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--cs-text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {customer.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <Link
                        href={`/crm/${customer.id}`}
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--cs-text)",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {customer.full_name}
                      </Link>
                      {segment && <CustomerSegmentBadge segment={segment} />}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                      {customer.phone}
                      {customer.email && (
                        <span style={{ marginLeft: 8 }}>{customer.email}</span>
                      )}
                    </div>
                    {customer.notes && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--cs-text-muted)",
                          marginTop: 2,
                          fontStyle: "italic",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        &ldquo;{customer.notes}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                        {customer.total_bookings} visit{customer.total_bookings !== 1 ? "s" : ""}
                      </div>
                      {customer.last_booking_date && (
                        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                          Last: {formatDate(customer.last_booking_date)}
                          {ds !== null && ds >= 30 && (
                            <span style={{ color: "#92400E", marginLeft: 4 }}>({ds}d)</span>
                          )}
                        </div>
                      )}
                      {preferredStaff && (
                        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                          Prefers {preferredStaff.full_name}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Link
                        href={`/crm/${customer.id}`}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--cs-border)",
                          backgroundColor: "var(--cs-surface)",
                          color: "var(--cs-text-secondary)",
                          fontSize: "0.75rem",
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        View
                      </Link>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--cs-border)",
                          backgroundColor: "var(--cs-surface-warm)",
                          color: "var(--cs-text-muted)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          opacity: 0.6,
                          cursor: "not-allowed",
                        }}
                        title="Coming soon"
                      >
                        Book again
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {total > 25 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              {page > 1 && (
                <Link
                  href={`/crm?page=${page - 1}`}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    backgroundColor: "var(--cs-surface)",
                    color: "var(--cs-text-muted)",
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                  }}
                >
                  &larr; Prev
                </Link>
              )}
              <span
                style={{
                  padding: "5px 12px",
                  fontSize: "0.8125rem",
                  color: "var(--cs-text-muted)",
                }}
              >
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/crm?page=${page + 1}`}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    backgroundColor: "var(--cs-surface)",
                    color: "var(--cs-text-muted)",
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                  }}
                >
                  Next &rarr;
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CrmEmptyState() {
  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <EmptyState
        title="No customer records yet"
        description="Customers will appear here automatically after online, walk-in, or home service bookings are created."
        icon="🌿"
        action={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/manager/walkin"
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                backgroundColor: "var(--cs-sand)",
                color: "#fff",
                fontSize: "0.8125rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Create Walk-in Booking
            </Link>
            <Link
              href="/book"
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Open Public Booking
            </Link>
          </div>
        }
      />

      {/* Guidance cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.75rem",
          padding: "0 1.5rem 1.5rem",
        }}
      >
        {[
          {
            icon: "➕",
            title: "Create a walk-in booking",
            desc: "Add a customer instantly at the front desk.",
            href: "/manager/walkin",
          },
          {
            icon: "🌐",
            title: "Test public booking",
            desc: "Simulate a guest booking from your website.",
            href: "/book",
          },
          {
            icon: "📥",
            title: "Import customers",
            desc: "Bulk import from a spreadsheet or previous system.",
            href: null,
          },
        ].map((card) =>
          card.href ? (
            <Link
              key={card.title}
              href={card.href}
              style={{
                padding: "1rem",
                borderRadius: "var(--cs-radius-lg)",
                backgroundColor: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border-light)",
                textDecoration: "none",
                color: "var(--cs-text)",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{card.icon}</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 2 }}>
                {card.title}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
                {card.desc}
              </div>
            </Link>
          ) : (
            <div
              key={card.title}
              style={{
                padding: "1rem",
                borderRadius: "var(--cs-radius-lg)",
                backgroundColor: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border-light)",
                opacity: 0.6,
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{card.icon}</div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: 2,
                  color: "var(--cs-text-muted)",
                }}
              >
                {card.title}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
                {card.desc}
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--cs-text-muted)",
                  marginTop: 4,
                  fontWeight: 600,
                }}
              >
                Coming soon
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
