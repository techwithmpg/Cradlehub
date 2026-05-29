import { redirect } from "next/navigation";

export const metadata = { title: "Staff Applications | Front Desk" };

export default async function CrmStaffApplicationsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "submitted";
  redirect(`/crm/staff?tab=applications&status=${status}`);
}
