/**
 * Manager Route Layout
 *
 * MVP: The Manager workspace is soft-paused. All /manager/* requests redirect to /crm.
 * The workspace files are preserved for future restoration.
 */

import { redirect } from "next/navigation";

export default function ManagerLayout() {
  redirect("/crm");
}
