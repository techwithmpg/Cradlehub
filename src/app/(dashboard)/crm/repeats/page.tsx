import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { CustomerSegmentBadge } from "@/components/features/crm/customer-segment-badge";
import { getRepeatCustomers } from "@/lib/queries/customers";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type RepeatCustomerItem = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "full_name" | "phone" | "email" | "total_bookings" | "last_booking_date" | "first_booking_date"
>;

const TAB_ITEMS = [
  { href: "/crm", label: "All Customers" },
  { href: "/crm/repeats", label: "Repeat Clients" },
  { href: "/crm/lapsed", label: "Lapsed Clients" },
];

export default async function RepeatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageParam = Number(resolvedSearchParams.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { customers, total } = await getRepeatCustomers(2, page, 25);
  const rows = customers as RepeatCustomerItem[];
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <PageHeader
        title="Repeat Clients"
        description="Guests who have booked 2 or more times. These are your loyal customers — reward them."
        icon="💛"
      />

      <div
        style={{
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          backgroundColor: "var(--cs-sage-light)",
          border: "1px solid var(--cs-sage)",
          borderRadius: 8,
          fontSize: "0.8125rem",
          color: "var(--cs-sage)",
          opacity: 0.9,
        }}
      >
        {total} repeat client{total !== 1 ? "s" : ""} in your database.
        Repeat clients typically spend more and are easier to rebook.
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {TAB_ITEMS.map((tab) => {
          const isActive = tab.href === "/crm/repeats";
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
        <EmptyState
          title="No repeat clients yet"
          description="Customers who have booked 2 or more times will appear here."
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
            {rows.map((customer, i) => (
              <Link
                key={customer.id}
                href={`/crm/${customer.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                  padding: "0.875rem 1rem",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--cs-border)" : "none",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "var(--cs-sand-lighter)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--cs-sand)",
                    flexShrink: 0,
                  }}
                >
                  {customer.total_bookings}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>
                      {customer.full_name}
                    </div>
                    <CustomerSegmentBadge segment="repeat" />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {customer.phone}
                    {customer.email && <span style={{ marginLeft: 8 }}>{customer.email}</span>}
                    {customer.first_booking_date && (
                      <span style={{ marginLeft: 8 }}>
                        Since {formatDate(customer.first_booking_date)}
                      </span>
                    )}
                  </div>
                </div>

                {customer.last_booking_date && (
                  <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", flexShrink: 0 }}>
                    Last: {formatDate(customer.last_booking_date)}
                  </span>
                )}
                <span style={{ color: "var(--cs-text-muted)", fontSize: 16 }}>&rsaquo;</span>
              </Link>
            ))}
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
                  href={`/crm/repeats?page=${page - 1}`}
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
                  href={`/crm/repeats?page=${page + 1}`}
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
