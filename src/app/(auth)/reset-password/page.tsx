import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F2EE] px-5 py-14 sm:px-8">
      <div className="w-full max-w-100">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="md" variant="light" className="mb-3 w-40 sm:w-44" />
          <span className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-[#6B5D52]">
            Staff Portal
          </span>
        </div>

        <div className="rounded-2xl border border-[#F0ECE5] bg-white p-7 shadow-[0_12px_36px_rgba(30,25,22,0.09),0_3px_10px_rgba(30,25,22,0.05)]">
          <div className="mb-6">
            <h1 className="mb-1 font-display text-[22px] font-semibold text-[#1E1916]">
              Choose a new password
            </h1>
            <p className="m-0 text-[13.5px] leading-relaxed text-[#6B5D52]">
              Use a fresh password for your CradleHub staff account.
            </p>
          </div>

          {user ? (
            <ResetPasswordForm email={user.email ?? null} />
          ) : (
            <>
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#EDCCCC] bg-[#F8EEEE] px-3.5 py-3 text-[12.5px] text-[#5A1A1A]">
                <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#8A5A5A]" />
                <span>Your reset link has expired. Request a new password reset link.</span>
              </div>
              <Link
                href="/forgot-password"
                className="cs-btn cs-btn-primary cs-btn-lg w-full justify-center"
              >
                Request new link
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
