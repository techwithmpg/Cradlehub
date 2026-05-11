import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Products | Cradle Wellness Living — Bacolod Spa & Wellness",
  description:
    "Discover wellness products and after-care recommendations at Cradle Wellness Living in Bacolod. Contact our front desk for guidance tailored to your service and self-care routine.",
  path: "/products",
});

export default function ProductsPage() {
  return (
    <>
      <main className="min-h-screen bg-[#FCFAF5] text-[#163A2B]">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-28 text-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#B68A3C]">
              Cradle Massage & Wellness Spa
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              Wellness care starts with the right guidance.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[#6B7A6F]">
              For product recommendations or after-care suggestions, our front desk can help you choose what fits your service, skin, and self-care routine.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/services"
                className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#163A2B] px-6 text-sm font-semibold text-[#FCFAF5]"
              >
                Explore Services
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#C8A96B] px-6 text-sm font-semibold text-[#163A2B]"
              >
                Ask Front Desk
              </Link>
            </div>
          </div>
        </div>
      </main>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
        ]}
      />
    </>
  );
}
