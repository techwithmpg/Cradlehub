/**
 * /crm/services — compatibility redirect
 *
 * Services configuration has moved to the unified Setup Center at /crm/setup.
 * This page redirects existing links/bookmarks to the correct Setup tab.
 *
 * Tab mapping:
 *   ?tab=services | ?tab=customization → /crm/setup?tab=services
 *   ?tab=providers | ?tab=staff        → /crm/setup?tab=providers
 *   ?tab=issues | ?tab=readiness_issues → /crm/setup?tab=public_readiness
 *   (default)                          → /crm/setup?tab=services
 */

import { redirect } from "next/navigation";

function resolveSetupTab(raw: string | undefined): string {
  if (!raw || raw === "services" || raw === "customization" || raw === "assignments") {
    return "services";
  }
  if (raw === "providers" || raw === "staff" || raw === "capabilities") {
    return "providers";
  }
  if (raw === "issues" || raw === "readiness_issues" || raw === "readiness" || raw === "public") {
    return "public_readiness";
  }
  return "services";
}

export default async function ServicesCompatRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  redirect(`/crm/setup?tab=${resolveSetupTab(params.tab)}`);
}
