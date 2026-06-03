import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getWorkspaceSwitchDestination } from "@/lib/auth/workspace-access";

async function signOutAction() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AccountSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaces = await getUserWorkspaceAccess(user.id);
  if (workspaces.length > 0) {
    redirect(getWorkspaceSwitchDestination(workspaces));
  }

  const { data: onboardingRequest } = await supabase
    .from("staff_onboarding_requests")
    .select("status, preferred_role, created_at")
    .eq("auth_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = onboardingRequest?.status ?? "needs_setup";
  const statusLabel =
    status === "submitted"
      ? "Application pending review"
      : status === "rejected"
        ? "Application not approved"
        : "Profile normalization needed";

  const message =
    status === "submitted"
      ? "Your staff application has been received. You will be able to choose a workspace once a manager approves and activates your account."
      : status === "rejected"
        ? "Your staff application was not approved. Please contact your branch manager or CRM team for the next step."
        : "Your login is active, but no usable workspace is connected to this account yet. Ask your branch manager or CRM team to link and activate your staff profile.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cs-bg)] px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-7 text-center shadow-xl shadow-black/10">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="md" />
        </div>

        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-xl font-semibold text-[var(--sp-forest)]">
          CH
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cs-sand)]">
          Account setup
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cs-text)]">
          {statusLabel}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--cs-text-muted)]">
          {message}
        </p>

        <div className="mt-6 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cs-text-muted)]">
            Signed in as
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--cs-text)]">
            {user.email ?? "Authenticated user"}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--sp-forest)] px-4 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/40"
            href="mailto:support@cradlewellnessliving.com"
          >
            Contact support
          </a>
          <form action={signOutAction}>
            <Button className="h-10 w-full sm:w-auto" type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
