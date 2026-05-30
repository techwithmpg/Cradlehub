import { redirect } from "next/navigation";

export default function RepeatsRedirectPage() {
  redirect("/crm/customers?tab=repeat");
}
