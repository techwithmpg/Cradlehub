import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { MasterSheetReview } from "@/components/features/crm/master-sheet/master-sheet-review";
import { loadOwnerSheetReview } from "@/lib/integrations/google-sheets/sheet-review-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Master Sheet Review — CRM" };

export default async function MasterSheetReviewPage() {
  const state = await loadOwnerSheetReview();
  if (state.status === "forbidden") notFound();

  return (
    <CrmOperationalPageShell
      title="Master Sheet Review"
      description="This information comes from CRADLE MAINSHEETS and does not modify CradleHub operational records."
      context="External source · Read only"
    >
      <MasterSheetReview state={state} />
    </CrmOperationalPageShell>
  );
}
