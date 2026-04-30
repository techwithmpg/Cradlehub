import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | CradleHub",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--cs-bg)",
        padding: "2rem 1rem",
      }}
    >
      {children}
    </div>
  );
}

