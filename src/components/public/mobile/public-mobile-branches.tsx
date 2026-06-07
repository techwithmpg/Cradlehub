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

const MOBILE_PUBLIC_SURFACE =
  "md:hidden bg-[radial-gradient(circle_at_80%_8%,rgba(212,181,122,0.10),transparent_34%),linear-gradient(180deg,#031B16_0%,#05241D_50%,#02140F_100%)] pb-12 pt-14 text-[#F6EBD6]";
const MOBILE_GLASS_CARD =
  "box-border border border-[#D4B57A]/22 bg-[#0D2B20]/70 shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";

export function PublicMobileBranches({ branches }: { branches: MobileBranch[] }) {
  return (
    <div className={MOBILE_PUBLIC_SURFACE}>
      <section className="bg-[#082E22] px-5 pb-7 pt-8 text-[#FCFAF5]">
        <h1
          className="text-[30px] font-medium leading-tight"
          style={{ fontFamily: "var(--sp-font-display)" }}
        >
          Our Branches
        </h1>
        <p className="mt-2 text-[13px] text-[#FCFAF5]/78">Find a branch near you.</p>
      </section>

      <section className="space-y-4 overflow-hidden px-4 py-5">
        {branches.map((branch, index) => (
          <article
            key={branch.id}
            className={`max-w-full overflow-hidden rounded-[10px] p-3 ${MOBILE_GLASS_CARD}`}
            style={{ width: "calc(100vw - 56px)" }}
          >
            <div className="relative h-[150px] w-full overflow-hidden rounded-[7px] bg-[#031B16]">
              <Image
                src={index % 2 === 0 ? SPA_IMAGES.contact : SPA_IMAGES.booking}
                alt={`${branch.name} branch`}
                fill
                className="object-cover"
                sizes="(max-width: 767px) 100vw, 360px"
              />
            </div>
            <div className="mt-3 min-w-0 overflow-hidden">
              <span className="inline-flex rounded-full border border-[#D4B57A]/24 bg-[#D4B57A]/12 px-2 py-1 text-[10px] font-semibold text-[#D4B57A]">
                Services vary by branch
              </span>
              <h2
                className="mt-2 break-words text-[19px] font-medium leading-6 text-[#F6EBD6]"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                {branch.name}
              </h2>
              {branch.address && (
                <p
                  className="mt-1 whitespace-normal text-[12px] leading-5 text-[#F6EBD6]/62"
                  style={{ maxWidth: "min(280px, calc(100vw - 90px))" }}
                >
                  {branch.address}
                </p>
              )}
              <div className="mt-3 space-y-1 text-[11px] text-[#F6EBD6]/70">
                <p className="flex min-w-0 items-start gap-1.5">
                  <Clock className="h-3 w-3 shrink-0 text-[#D4B57A]" aria-hidden="true" />
                  <span className="min-w-0 break-words">
                    {branch.opening_hours ?? "Daily availability through booking"}
                  </span>
                </p>
                {branch.phone && (
                  <p className="flex min-w-0 items-start gap-1.5">
                    <Phone className="h-3 w-3 shrink-0 text-[#D4B57A]" aria-hidden="true" />
                    <span className="min-w-0 break-words">{branch.phone}</span>
                  </p>
                )}
              </div>
            </div>

            <div
              className={
                branch.phone
                  ? "mt-3 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 overflow-hidden"
                  : "mt-3"
              }
            >
              {branch.phone && (
                <a
                  href={`tel:${branch.phone.replace(/\s/g, "")}`}
                  className="flex min-h-9 min-w-0 overflow-hidden items-center justify-center gap-2 rounded-[6px] border border-[#D4B57A]/32 bg-[#031B16]/50 px-2 text-[11px] font-semibold uppercase text-[#F6EBD6]"
                >
                  <Phone className="h-3.5 w-3.5 text-[#D4B57A]" aria-hidden="true" />
                  <span className="truncate">Call</span>
                </a>
              )}
              <a
                href={mapHref(branch)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-9 min-w-0 overflow-hidden items-center justify-center gap-1.5 rounded-[6px] border border-[#D4B57A]/32 bg-[#031B16]/50 px-2 text-[10.5px] font-semibold uppercase text-[#F6EBD6]"
              >
                <Navigation className="h-3.5 w-3.5 text-[#D4B57A]" aria-hidden="true" />
                <span className="truncate">Directions</span>
              </a>
            </div>
            <Link
              href="/book"
              className="mt-3 flex min-h-10 w-full max-w-full items-center justify-center rounded-[6px] bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#031B16]"
            >
              Book Now
            </Link>
          </article>
        ))}

        {branches.length === 0 && (
          <div className={`rounded-[10px] p-6 text-center ${MOBILE_GLASS_CARD}`}>
            <MapPin className="mx-auto h-6 w-6 text-[#D4B57A]" aria-hidden="true" />
            <p className="mt-3 text-[13px] font-semibold text-[#F6EBD6]">
              Branches are being prepared.
            </p>
            <p className="mt-1 text-[12px] text-[#F6EBD6]/62">
              Please contact the front desk for the latest branch availability.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
