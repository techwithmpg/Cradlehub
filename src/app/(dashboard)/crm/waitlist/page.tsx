import { redirect } from "next/navigation";

export default function WaitlistRedirectPage() {
  redirect("/crm/customers?tab=followup");
}
