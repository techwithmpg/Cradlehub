import type { Metadata } from "next";
import { BoutiqueClient } from "@/components/public/boutique-client";
import { BreadcrumbJsonLd } from "@/components/seo/structured-data";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Cradle Boutique | Spa Essentials, Oils & Gift Certificates in Bacolod",
  description:
    "Explore signature botanical massage oils, relaxing linen spray, and spa gift certificates from Cradle Wellness Living in Bacolod.",
  path: "/products",
});

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const initialCategory =
    typeof params.category === "string" ? params.category : "all";

  return (
    <>
      <BoutiqueClient initialCategory={initialCategory} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Boutique", path: "/products" },
        ]}
      />
    </>
  );
}
