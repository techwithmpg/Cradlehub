import type { Metadata } from "next";
import { BookingWizard } from "@/components/public/booking-wizard";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Book Online | Massage & Wellness Appointments in Bacolod",
  description:
    "Book your massage or wellness appointment online with Cradle Wellness Living in Bacolod. Choose in-spa or home service, select your treatment, and confirm your schedule.",
  path: "/book",
});

export default function BookPage() {
  return (
    <>
      <BookingWizard />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Book", path: "/book" },
        ]}
      />
    </>
  );
}
