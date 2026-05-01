import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { CustomerSegmentBadge } from "@/components/features/crm/customer-segment-badge";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getAllCustomers } from "@/lib/queries/customers";
import { formatDate } from "@/lib/utils";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";

async function getCsrContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  const allowedRoles = [
    "owner", "manager", "assistant_manager", "store_manager",
    "crm", "csr", "csr_head", "csr_staff",
  ];

  if (!me && isDevAuthBypassEnabled()) {
    return { role: "owner" };
  }

  if (!me || !allowedRoles.includes(me.system_role)) {
    redirect("/login");
  }

  return { role: me.system_role };
}

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

export default async function CrmCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await getCsrContext();
  const resolvedSearchParams = await searchParams;
  const pageParam = Number(resolvedSearchParams.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { customers, total } = await getAllCustomers(page, 25);
  const rows = customers as unknown as CustomerListItem[];
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Search, view, and manage guest records."
        icon="👥"
        action={
          <Link
            href="/crm/bookings/new"
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
            ➕ New Booking
          </Link>
        }
      />

      {/* Quick action cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
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
              backgroundColor: "var(--cs-sand-mist)",
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
              2+ bookings · Loyal guests
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
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No customer records yet"
          description="Customers will appear here automatically after bookings are created."
          icon="🌿"
        />
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
                      <Link
                        href={`/crm/bookings/new?customerId=${customer.id}`}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--cs-border)",
                          backgroundColor: "var(--cs-sand-mist)",
                          color: "var(--cs-sand)",
                          fontSize: "0.75rem",
                          textDecoration: "none",
                          fontWeight: 500,
                        }}
                      >
                        Book
                      </Link>
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
                  href={`/crm/customers?page=${page - 1}`}
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
                  href={`/crm/customers?page=${page + 1}`}
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
