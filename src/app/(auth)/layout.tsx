import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Cradle Hub",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}