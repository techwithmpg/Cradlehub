import type { Metadata } from "next";
import { BookingWizard } from "@/components/public/booking-wizard";
import { BreadcrumbJsonLd } from "@/components/seo/structured-data";
import { buildMetadata } from "@/lib/seo/metadata";
import type { VisitType } from "@/lib/bookings/visit-type-availability";

export const metadata: Metadata = buildMetadata({
  title: "Book an Appointment | Cradle Wellness Living — Bacolod Massage & Spa",
  description:
    "Book a massage, spa package, or wellness service online at Cradle Wellness Living in Bacolod. Choose your branch, service, schedule, and preferred therapist.",
  path: "/book",
});

export default async function BookPage({
  searchParams,
}: {
  searchParams?: Promise<{
    branchId?: string;
    serviceId?: string;
    visitType?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : {};
  const initialBranchId =
    typeof params.branchId === "string" && params.branchId.trim()
      ? params.branchId.trim()
      : null;
  const initialServiceId =
    typeof params.serviceId === "string" && params.serviceId.trim()
      ? params.serviceId.trim()
      : null;
  const initialVisitType: VisitType | undefined =
    params.visitType === "home_service"
      ? "home_service"
      : params.visitType === "in_spa"
        ? "in_spa"
        : undefined;

  return (
    <>
      <BookingWizard
        initialBranchId={initialBranchId}
        initialServiceId={initialServiceId}
        initialVisitType={initialVisitType}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Book Appointment", path: "/book" },
        ]}
      />
    </>
  );
}
