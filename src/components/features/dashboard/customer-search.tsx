"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  total_bookings: number;
  last_booking_date: string | null;
};

type SearchResponse = {
  customers?: Customer[];
};

export function CustomerSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      const clearTimer = window.setTimeout(() => {
        setResults([]);
        setOpen(false);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/customers/search?q=${encodeURIComponent(trimmed)}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to search customers");
          }
          return (await response.json()) as SearchResponse;
        })
        .then((data) => {
          setResults(data.customers ?? []);
          setOpen(true);
        })
        .catch(() => {
          setResults([]);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/crm/${id}`);
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
      <div style={{ position: "relative" }}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by name or phone..."
          style={{
            width: "100%",
            height: 38,
            borderRadius: 8,
            border: "1px solid var(--cs-border)",
            padding: "0 2.5rem 0 0.875rem",
            fontSize: "0.875rem",
            color: "var(--cs-text)",
            backgroundColor: "var(--cs-surface)",
            outline: "none",
          }}
        />
        {loading && (
          <div
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
            }}
          >
            ...
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              zIndex: 20,
              overflow: "hidden",
            }}
          >
            {results.map((customer, i) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelect(customer.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "10px 14px",
                  border: "none",
                  borderBottom: i < results.length - 1 ? "1px solid var(--cs-border)" : "none",
                  backgroundColor: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = "var(--cs-bg)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "var(--cs-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--cs-text-muted)",
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
                      color: "var(--cs-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {customer.full_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {customer.phone}
                    {customer.total_bookings > 0 && (
                      <span style={{ marginLeft: 8 }}>
                        {customer.total_bookings} visit{customer.total_bookings !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 16, color: "var(--cs-text-muted)" }}>›</div>
              </button>
            ))}
          </div>
        </>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 8,
            padding: "1rem",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--cs-text-muted)",
            zIndex: 20,
          }}
        >
          No customers found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

