import { PageHeader } from "@/components/features/dashboard/page-header";
import { getMarketingMediaAssets, getMarketingMediaUsageMap } from "@/lib/queries/marketing-media";
import { MediaLibraryView } from "@/components/features/marketing/media/media-library-view";
import { createClient } from "@/lib/supabase/server";

export default async function MediaLibraryPage() {
  const assets = await getMarketingMediaAssets({ limit: 150 });
  const serializableUsageMap = await getMarketingMediaUsageMap(assets);

  // Determine user role
  let userRole: "owner" | "digital_marketer" = "digital_marketer";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase
        .from("staff")
        .select("system_role")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (me?.system_role === "owner") {
        userRole = "owner";
      }
    }
  } catch {
    // Default to marketer
  }

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Central visual library for public site imagery, brand assets, and service photos."
      />

      <MediaLibraryView
        initialAssets={assets}
        initialUsageMap={serializableUsageMap}
        userRole={userRole}
      />
    </div>
  );
}
