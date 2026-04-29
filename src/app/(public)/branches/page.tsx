import type { Metadata } from "next";
import Link from "next/link";
import { BranchCard } from "@/components/features/public/branch-card";
import { getAllBranches } from "@/lib/queries/branches";
import type { Tables } from "@/types/supabase";

type Branch = Tables<"branches">;

export const metadata: Metadata = { title: "Locations" };

export default async function BranchesPage() {
  const branchesResult = await getAllBranches();
  const branches = branchesResult as Branch[];

  return (
    <div style={{ padding: "2.5rem 0 4rem" }}>
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
        Our Locations
      </h1>
      <p
        style={{
          fontSize: "1rem",
          color: "var(--ch-text-muted)",
          marginBottom: "2.5rem",
          lineHeight: 1.6,
        }}
      >
        Visit us at any branch in Bacolod City. Home service is also available.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.25rem",
          marginBottom: "3rem",
        }}
      >
        {branches.map((branch) => (
          <BranchCard
            key={branch.id}
            id={branch.id}
            name={branch.name}
            address={branch.address}
            phone={branch.phone}
            messengerLink={branch.messenger_link}
            mapsEmbedUrl={branch.maps_embed_url}
          />
        ))}
      </div>

      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "var(--ch-accent-light)",
          border: "1px solid var(--ch-border)",
          borderRadius: 12,
          display: "flex",
          gap: "1rem",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--ch-text)",
              marginBottom: "0.25rem",
            }}
          >
            Home Service Available
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--ch-text-muted)", lineHeight: 1.6 }}>
            Our therapists can visit your home, office, or hotel. Select home service while booking
            online, or message us to arrange details.
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <Link
              href="/book"
              style={{
                padding: "8px 18px",
                borderRadius: 7,
                backgroundColor: "var(--ch-accent)",
                color: "var(--ch-surface)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Book Home Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
