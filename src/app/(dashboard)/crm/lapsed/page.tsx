import { redirect } from "next/navigation";

export default function LapsedRedirectPage() {
  redirect("/crm/customers?tab=lapsed");
}
