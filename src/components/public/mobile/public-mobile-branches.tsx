import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

type MobileBranch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  opening_hours?: string | null;
};

function mapHref(branch: MobileBranch) {
  return `https://maps.google.com/?q=${encodeURIComponent(
    branch.address || branch.name
  )}`;
}

export function PublicMobileBranches({ branches }: { branches: MobileBranch[] }) {
  return (
    <div className="md:hidden bg-[#FBF6EC] pb-12 pt-14 text-[#10261D]">
      <section className="bg-[#082E22] px-5 pb-7 pt-8 text-[#FCFAF5]">
        <h1
          className="text-[30px] font-medium leading-tight"
          style={{ fontFamily: "var(--sp-font-display)" }}
        >
          Our Branches
        </h1>
        <p className="mt-2 text-[13px] text-[#FCFAF5]/78">Find a branch near you.</p>
      </section>

      <section className="space-y-4 px-4 py-5">
        {branches.map((branch, index) => (
          <article
            key={branch.id}
            className="rounded-[10px] border border-[#E8DDCA] bg-[#FCFAF5] p-3 shadow-[0_8px_22px_rgba(16,38,29,0.08)]"
          >
            <div className="grid grid-cols-[104px_1fr] gap-3">
              <div className="relative h-[118px] overflow-hidden rounded-[7px] bg-[#E9DDC8]">
                <Image
                  src={index % 2 === 0 ? SPA_IMAGES.contact : SPA_IMAGES.booking}
                  alt={`${branch.name} branch`}
                  fill
                  className="object-cover"
                  sizes="104px"
                />
              </div>
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-[#F6E8C8] px-2 py-1 text-[10px] font-semibold text-[#9A6A1F]">
                  Services vary by branch
                </span>
                <h2
                  className="mt-2 line-clamp-1 text-[19px] font-medium"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  {branch.name}
                </h2>
                {branch.address && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#5F6F63]">
                    {branch.address}
                  </p>
                )}
                <div className="mt-2 space-y-1 text-[10.5px] text-[#3F4F44]">
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-[#10261D]" aria-hidden="true" />
                    {branch.opening_hours ?? "Daily availability through booking"}
                  </p>
                  {branch.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-[#10261D]" aria-hidden="true" />
                      {branch.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className={branch.phone ? "mt-3 grid grid-cols-2 gap-2" : "mt-3"}>
              {branch.phone && (
                <a
                  href={`tel:${branch.phone.replace(/\s/g, "")}`}
                  className="flex min-h-9 items-center justify-center gap-2 rounded-[6px] border border-[#E8DDCA] bg-white text-[11px] font-semibold uppercase"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Call
                </a>
              )}
              <a
                href={mapHref(branch)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-9 items-center justify-center gap-2 rounded-[6px] border border-[#E8DDCA] bg-white text-[11px] font-semibold uppercase"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                Directions
              </a>
            </div>
            <Link
              href="/book"
              className="mt-3 flex min-h-10 items-center justify-center rounded-[6px] bg-[#063D2D] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FCFAF5]"
            >
              Book Now
            </Link>
          </article>
        ))}

        {branches.length === 0 && (
          <div className="rounded-[10px] border border-[#E8DDCA] bg-white p-6 text-center">
            <MapPin className="mx-auto h-6 w-6 text-[#C8A96B]" aria-hidden="true" />
            <p className="mt-3 text-[13px] font-semibold">Branches are being prepared.</p>
            <p className="mt-1 text-[12px] text-[#5F6F63]">
              Please contact the front desk for the latest branch availability.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
