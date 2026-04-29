import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { CustomerSearch } from "@/components/features/dashboard/customer-search";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getAllCustomers } from "@/lib/queries/customers";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type CustomerListItem = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "full_name" | "phone" | "email" | "total_bookings" | "last_booking_date"
>;

function VisitBadge({ count }: { count: number }) {
  if (count === 0) return null;
  const isRepeat = count >= 3;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 20,
        fontSize: "0.6875rem",
        fontWeight: 600,
        backgroundColor: isRepeat ? "var(--ch-accent-light)" : "var(--ch-border)",
        color: isRepeat ? "var(--ch-accent)" : "var(--ch-text-muted)",
      }}
    >
      {count} visit{count !== 1 ? "s" : ""}
    </span>
  );
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageParam = Number(resolvedSearchParams.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { customers, total } = await getAllCustomers(page, 25);
  const rows = customers as CustomerListItem[];
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <PageHeader title="Customers" description={`${total.toLocaleString()} total customers`} />

      <div style={{ marginBottom: "1.25rem" }}>
        <CustomerSearch />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {[
          { href: "/crm", label: "All Customers" },
          { href: "/crm/repeats", label: "Repeat Clients" },
          { href: "/crm/lapsed", label: "Lapsed Clients" },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "1px solid var(--ch-border)",
              backgroundColor: "var(--ch-surface)",
              color: "var(--ch-text-muted)",
              fontSize: "0.8125rem",
              textDecoration: "none",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Customers are added automatically when bookings are created."
        />
      ) : (
        <>
          <div
            style={{
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
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
                  padding: "0.75rem 1rem",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--ch-border)" : "none",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: "var(--ch-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--ch-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {customer.full_name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--ch-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {customer.full_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
                    {customer.phone}
                    {customer.email && <span style={{ marginLeft: 8 }}>{customer.email}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                  <VisitBadge count={customer.total_bookings} />
                  {customer.last_booking_date && (
                    <span style={{ fontSize: "0.75rem", color: "var(--ch-text-subtle)" }}>
                      Last: {formatDate(customer.last_booking_date)}
                    </span>
                  )}
                  <span style={{ color: "var(--ch-text-subtle)", fontSize: 16 }}>›</span>
                </div>
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
                  href={`/crm?page=${page - 1}`}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--ch-border)",
                    backgroundColor: "var(--ch-surface)",
                    color: "var(--ch-text-muted)",
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                  }}
                >
                  ← Prev
                </Link>
              )}
              <span
                style={{
                  padding: "5px 12px",
                  fontSize: "0.8125rem",
                  color: "var(--ch-text-muted)",
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
                    border: "1px solid var(--ch-border)",
                    backgroundColor: "var(--ch-surface)",
                    color: "var(--ch-text-muted)",
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                  }}
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
