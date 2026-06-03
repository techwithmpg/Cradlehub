import { getMyServiceProgressAction } from "../actions";
import { TherapistServiceProgressPage } from "@/components/features/staff-portal/therapist/therapist-service-progress-page";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

type ProgressResult =
  | { error: string }
  | { active: StaffPortalBooking[]; completed: StaffPortalBooking[] };

export default async function ServiceProgressPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const result = (await getMyServiceProgressAction(today)) as ProgressResult;

  if ("error" in result) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        {result.error}
      </div>
    );
  }

  return (
    <TherapistServiceProgressPage
      active={result.active}
      completed={result.completed}
    />
  );
}
