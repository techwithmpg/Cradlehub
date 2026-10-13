import type { Metadata } from "next";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { StaffServiceWorkerRegistration } from "@/components/features/staff-pwa/staff-service-worker-registration";

export const metadata: Metadata = {
  title: "Staff sign in | Cradle Hub",
  manifest: "/manifest-staff.webmanifest",
  applicationName: "Cradle Hub",
  icons: { icon: "/staff-pwa-icon-48-gold.png", apple: "/staff-pwa-apple-touch-icon-180-gold.png" },
  appleWebApp: { capable: true, title: "Cradle Hub", statusBarStyle: "black-translucent" },
};

export default function StaffPwaLoginPage() {
  return (
    <>
      <StaffServiceWorkerRegistration />
      <LoginForm passwordUpdated={false} staffPwa />
    </>
  );
}
