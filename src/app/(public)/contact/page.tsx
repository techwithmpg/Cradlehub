import type { Metadata } from "next";
import Link from "next/link";
import { getAllBranches } from "@/lib/queries/branches";
import type { Tables } from "@/types/supabase";

type Branch = Tables<"branches">;

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const branchesResult = await getAllBranches();
  const branches = branchesResult as Branch[];
  const messengerBranches = branches.filter((branch) => Boolean(branch.messenger_link));

  return (
    <div style={{ padding: "2.5rem 0 4rem", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/" style={{ fontSize: "0.8125rem", color: "var(--ch-text-muted)", textDecoration: "none" }}>
          Back to home
        </Link>
      </div>

      <h1
        style={{
          fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
          fontWeight: 700,
          color: "var(--ch-text)",
          marginBottom: "0.5rem",
        }}
      >
        Get in Touch
      </h1>
      <p
        style={{
          fontSize: "1rem",
          color: "var(--ch-text-muted)",
          marginBottom: "2.5rem",
          lineHeight: 1.6,
        }}
      >
        Questions or home service requests? The fastest way to reach us is Facebook Messenger.
      </p>

      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "var(--ch-surface)",
          border: "1px solid var(--ch-border)",
          borderRadius: 12,
          textAlign: "center",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "var(--ch-text)",
            marginBottom: "0.375rem",
          }}
        >
          Message us on Facebook
        </div>
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--ch-text-muted)",
            marginBottom: "1.25rem",
            lineHeight: 1.6,
          }}
        >
          We usually reply within a few hours. You can also book directly through Messenger.
        </div>

        {messengerBranches.length > 0 && (
          <div style={{ display: "flex", gap: "0.625rem", justifyContent: "center", flexWrap: "wrap" }}>
            {messengerBranches.map((branch) => (
              <a
                key={branch.id}
                href={branch.messenger_link ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  backgroundColor: "var(--ch-accent)",
                  color: "var(--ch-surface)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Message {branch.name}
              </a>
            ))}
          </div>
        )}
      </div>

      <h2
        style={{
          fontSize: "1.0625rem",
          fontWeight: 600,
          color: "var(--ch-text)",
          marginBottom: "1rem",
        }}
      >
        Branch Contacts
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {branches.map((branch) => (
          <div
            key={branch.id}
            style={{
              padding: "1rem 1.25rem",
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--ch-text)",
                marginBottom: "0.375rem",
              }}
            >
              {branch.name}
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--ch-text-muted)", lineHeight: 1.6 }}>
              <div>Address: {branch.address}</div>
              {branch.phone && <div style={{ marginTop: 2 }}>Phone: {branch.phone}</div>}
              {branch.email && <div style={{ marginTop: 2 }}>Email: {branch.email}</div>}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "2.5rem",
          textAlign: "center",
          padding: "1.5rem",
          backgroundColor: "var(--ch-surface)",
          border: "1px solid var(--ch-border)",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: "0.9375rem",
            color: "var(--ch-text-muted)",
            marginBottom: "1rem",
          }}
        >
          Ready to book? Complete your online booking in about two minutes.
        </div>
        <Link
          href="/book"
          style={{
            padding: "10px 28px",
            borderRadius: 8,
            backgroundColor: "var(--ch-accent)",
            color: "var(--ch-surface)",
            fontSize: "0.9375rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Book Online Now
        </Link>
      </div>
    </div>
  );
}
