import { redirect } from "next/navigation";

export default function CrmControlPage() {
  redirect("/crm/today?filter=all");
}
