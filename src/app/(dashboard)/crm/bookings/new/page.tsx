import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { BookingWizard } from "@/components/public/booking-wizard";
import { createClient } from "@/lib/supabase/server";

type StaffContext = {
  branch_id: string | null;
  system_role: string;
};

async function getDefaultBranchId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  const me = (data ?? null) as StaffContext | null;
  const allowedRoles = ["owner", "crm", "csr", "csr_head", "csr_staff"];
  if (!me || !allowedRoles.includes(me.system_role)) {
    redirect("/crm");
  }

  return me.branch_id;
}

export default async function CrmBookingWizardPage() {
  const defaultBranchId = await getDefaultBranchId();

  return (
    <div>
      <PageHeader
        title="New In-House Booking"
        description="Create a booking for walk-in, phone, or staff-assisted customers."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/crm">Back to CRM Hub</Link>
          </Button>
        }
      />

      <BookingWizard mode="inhouse" initialBranchId={defaultBranchId} />
    </div>
  );
}
