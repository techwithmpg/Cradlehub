import type { Metadata } from "next";
import { BranchCard } from "@/components/features/public/branch-card";
import { getAllBranches } from "@/lib/queries/branches";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export const metadata: Metadata = { title: "Contact & Locations" };

export default async function ContactPage() {
  const branches = (await getAllBranches()) as BranchRow[];

  return (
    <>
      <section
        style={{
          background: "var(--pw-forest-deep)",
          padding: "72px 28px 56px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(201,169,110,0.7)",
              marginBottom: 16,
            }}
          >
            Get in Touch
          </div>
          <h1
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: "clamp(32px, 6vw, 48px)",
              fontWeight: 300,
              color: "var(--pw-cream)",
              marginBottom: 14,
            }}
          >
            We&apos;d love to hear from you
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(247,243,237,0.55)",
              lineHeight: 1.7,
            }}
          >
            Questions, group bookings, or just unsure which treatment to choose —
            our team is happy to help.
          </p>
        </div>
      </section>

      <section style={{ padding: "var(--pw-section) 28px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* Messenger CTA */}
          <div
            style={{
              background: "var(--pw-mist)",
              border: "1px solid var(--pw-moss)",
              borderRadius: "var(--pw-radius-lg)",
              padding: "28px 32px",
              textAlign: "center",
              marginBottom: 40,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: 22,
                fontWeight: 400,
                color: "var(--pw-forest)",
                marginBottom: 8,
              }}
            >
              Fastest way to reach us
            </h2>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--pw-warm)",
                lineHeight: 1.65,
                marginBottom: 20,
                maxWidth: 400,
                margin: "0 auto 20px",
              }}
            >
              Message us on Facebook Messenger — we typically respond within one hour.
              You can also book directly through Messenger.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {branches
                .filter((b) => b.messenger_link)
                .map((b) => (
                  <a
                    key={b.id}
                    href={b.messenger_link ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "11px 24px",
                      background: "var(--pw-forest)",
                      color: "var(--pw-cream)",
                      fontSize: 11.5,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textDecoration: "none",
                      borderRadius: "var(--pw-radius)",
                    }}
                  >
                    Message {b.name}
                  </a>
                ))}
            </div>
          </div>

          {/* Branch cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              marginBottom: 40,
            }}
          >
            {branches.map((b) => (
              <BranchCard
                key={b.id}
                id={b.id}
                name={b.name}
                address={b.address ?? "Bacolod City"}
                phone={b.phone}
                email={b.email}
                messengerLink={b.messenger_link}
                mapsEmbedUrl={b.maps_embed_url}
                hours="Daily · 9:00 AM – 9:00 PM"
              />
            ))}
          </div>

          {/* Contact form */}
          <div
            style={{
              background: "var(--pw-white)",
              border: "1px solid var(--pw-border)",
              borderRadius: "var(--pw-radius-lg)",
              padding: "32px 28px",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: 22,
                fontWeight: 400,
                color: "var(--pw-ink)",
                marginBottom: 24,
              }}
            >
              Send us a message
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <FormField label="Name">
                <input type="text" placeholder="Your name" />
              </FormField>
              <FormField label="Phone">
                <input type="tel" placeholder="+63 XXX XXX XXXX" />
              </FormField>
            </div>
            <FormField label="Subject">
              <select>
                <option>General Enquiry</option>
                <option>Home Service Booking</option>
                <option>Group Booking</option>
                <option>Service Pricing</option>
                <option>Feedback</option>
              </select>
            </FormField>
            <FormField label="Message">
              <textarea placeholder="How can we help you?" />
            </FormField>
            <button
              style={{
                width: "100%",
                padding: "14px 0",
                background: "linear-gradient(135deg, var(--pw-gold), #D4B87A)",
                color: "var(--pw-forest-deep)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: "var(--pw-radius)",
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Send Message
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--pw-warm)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
