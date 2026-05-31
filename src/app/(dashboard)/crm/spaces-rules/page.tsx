/**
 * /crm/spaces-rules — compatibility redirect
 *
 * Spaces & Rules configuration has moved to the unified Setup Center at /crm/setup.
 * All existing links/bookmarks redirect to /crm/setup?tab=spaces.
 */

import { redirect } from "next/navigation";

export default function SpacesRulesCompatRedirectPage() {
  redirect("/crm/setup?tab=spaces");
}
