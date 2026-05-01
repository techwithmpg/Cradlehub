import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | CradleHub",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
