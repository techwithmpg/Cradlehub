/**
 * Owner Route Layout
 *
 * MVP: The Owner workspace is soft-paused. All /owner/* requests redirect to /crm.
 * The workspace files are preserved for future restoration.
 */

import { redirect } from "next/navigation";

export default function OwnerLayout() {
  redirect("/crm");
}
