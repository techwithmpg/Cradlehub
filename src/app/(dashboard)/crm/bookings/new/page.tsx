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

type CustomerPrefill = {
  fullName: string;
  phone: string;
  email: string | null;
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
    .maybeSingle();

  const me = (data ?? null) as StaffContext | null;
  const allowedRoles = ["owner", "crm", "csr", "csr_head", "csr_staff"];
  if (!me || !allowedRoles.includes(me.system_role)) {
    redirect("/crm");
  }

  return me.branch_id;
}

async function getCustomerPrefill(customerId: string | undefined): Promise<CustomerPrefill | null> {
  if (!customerId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("full_name, phone, email")
    .eq("id", customerId)
    .maybeSingle();

  if (!data) return null;
  return {
    fullName: data.full_name,
    phone: data.phone,
    email: data.email,
  };
}

export default async function CrmBookingWizardPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const defaultBranchId = await getDefaultBranchId();
  const customerPrefill = await getCustomerPrefill(params.customerId);

  return (
    <div>
      <PageHeader
        title="New In-House Booking"
        description="Create a booking for walk-in, phone, or staff-assisted customers."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/crm/today">Back to Today</Link>
          </Button>
        }
      />

      <BookingWizard
        key={`${defaultBranchId ?? "none"}-${params.customerId ?? "new"}`}
        mode="inhouse"
        initialBranchId={defaultBranchId}
        initialCustomer={customerPrefill}
      />
    </div>
  );
}
