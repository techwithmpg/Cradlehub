import { notFound } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getStaffForOnboard } from "@/lib/queries/staff";
import { OnboardForm } from "./onboard-form";

export default async function OnboardPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  const staff = await getStaffForOnboard(staffId);

  if (!staff) {
    notFound();
  }

  // Verify claimable state
  if (staff.auth_user_id) {
    return (
      <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center", padding: "0 1rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "var(--cs-text)", marginBottom: "0.5rem" }}>
          Already Claimed
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
          This invite has already been used. Your account is pending approval from the owner or manager.
        </p>
      </div>
    );
  }

  if (staff.is_active) {
    return (
      <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center", padding: "0 1rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "var(--cs-text)", marginBottom: "0.5rem" }}>
          Invite No Longer Valid
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
          This invite link is no longer active. Please contact your administrator for a new invite.
        </p>
      </div>
    );
  }

  // Check expiry (7 days)
  const createdAt = new Date(staff.created_at);
  const expiry = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiry;

  if (isExpired) {
    return (
      <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center", padding: "0 1rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏰</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "var(--cs-text)", marginBottom: "0.5rem" }}>
          Invite Expired
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
          This invite link expired on {expiry.toLocaleDateString("en-PH")}. Please ask your administrator to generate a new one.
        </p>
      </div>
    );
  }

  const branchName = (staff.branches as { name: string } | null)?.name ?? "your branch";

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
      <PageHeader
        title="Welcome to Cradle Spa"
        description={`Complete your profile to join ${branchName}. Your account will be reviewed before activation.`}
        icon="🌿"
      />
      <OnboardForm staffId={staffId} />
    </div>
  );
}
