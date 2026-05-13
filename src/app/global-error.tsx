"use client";

export const dynamic = "force-dynamic";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <h2 style={{ color: "#163A2B" }}>Something went wrong</h2>
        <p style={{ color: "#6B7A6F", marginBottom: "1rem" }}>
          {error.message ?? "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          style={{ padding: "0.5rem 1.25rem", borderRadius: 6, background: "#A67B5B", color: "#fff", border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
