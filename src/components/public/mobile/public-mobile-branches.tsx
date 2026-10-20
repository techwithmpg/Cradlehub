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
  location_metadata?: unknown;
};

function mapHref(branch: MobileBranch) {
  return `https://maps.google.com/?q=${encodeURIComponent(branch.address || branch.name)}`;
}

const MOBILE_PUBLIC_SURFACE =
  "md:hidden bg-[radial-gradient(circle_at_80%_8%,rgba(212,181,122,0.10),transparent_34%),linear-gradient(180deg,#031B16_0%,#05241D_50%,#02140F_100%)] pb-12 pt-14 text-[#F6EBD6]";
const MOBILE_GLASS_CARD =
  "box-border border border-[#D4B57A]/22 bg-[#0D2B20]/70 shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";

export function PublicMobileBranches({
  branches,
  fallbackImage,
}: {
  branches: MobileBranch[];
  fallbackImage?: string;
}) {
  return (
    <div className={MOBILE_PUBLIC_SURFACE}>
      <section className="bg-[#082E22] px-5 pb-7 pt-8 text-[#FCFAF5]">
        <h1
          className="text-[30px] font-medium leading-tight"
          style={{ fontFamily: "var(--sp-font-display)" }}
        >
          Our Branches
        </h1>
        <p className="mt-2 text-[13px] text-[#FCFAF5]/84">
          Visit us at our calming Bacolod locations.
        </p>
      </section>

      <section className="space-y-4 overflow-hidden px-4 py-5">
        {branches.map((branch, index) => {
          const metaImg =
            branch.location_metadata &&
            typeof branch.location_metadata === "object" &&
            "image_url" in branch.location_metadata &&
            typeof branch.location_metadata.image_url === "string" &&
            branch.location_metadata.image_url.trim().length > 0
              ? branch.location_metadata.image_url.trim()
              : null;
          const imgSrc =
            metaImg || fallbackImage || (index % 2 === 0 ? SPA_IMAGES.contact : SPA_IMAGES.booking);

          return (
            <article
              key={branch.id}
              className={`max-w-full overflow-hidden rounded-[10px] p-3 ${MOBILE_GLASS_CARD}`}
              style={{ width: "calc(100vw - 56px)" }}
            >
              <div className="relative h-[150px] w-full overflow-hidden rounded-[7px] bg-[#031B16]">
                <Image
                  src={imgSrc}
                  alt={branch.name}
                  fill
                  className="object-cover"
                  sizes="calc(100vw - 56px)"
                />
                <div className="absolute inset-0 bg-[#031B16]/25" />
              </div>

              <div className="mt-3">
                <h2
                  className="text-[17px] font-medium text-[#F6EBD6]"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  {branch.name}
                </h2>
                {branch.address ? (
                  <p className="mt-1 flex items-start gap-1.5 text-[12px] text-[#F6EBD6]/75">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4B57A]" />
                    <span>{branch.address}</span>
                  </p>
                ) : null}
                {branch.phone ? (
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[#F6EBD6]/75">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#D4B57A]" />
                    <a
                      href={`tel:${branch.phone.replace(/\s/g, "")}`}
                      className="underline decoration-[#D4B57A]/40 hover:text-[#D4B57A]"
                    >
                      {branch.phone}
                    </a>
                  </p>
                ) : null}
                {branch.opening_hours ? (
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[#F6EBD6]/75">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#D4B57A]" />
                    <span>{branch.opening_hours}</span>
                  </p>
                ) : null}

                <div className="mt-3.5 flex gap-2">
                  <a
                    href={mapHref(branch)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#D4B57A]/35 bg-[#031B16]/40 py-2 text-[11px] font-semibold text-[#F6EBD6] backdrop-blur-md"
                  >
                    <Navigation className="h-3 w-3 text-[#D4B57A]" />
                    Directions
                  </a>
                  {branch.phone ? (
                    <a
                      href={`tel:${branch.phone.replace(/\s/g, "")}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#D4B57A]/35 bg-[#031B16]/40 py-2 text-[11px] font-semibold text-[#F6EBD6] backdrop-blur-md"
                    >
                      <Phone className="h-3 w-3 text-[#D4B57A]" />
                      Call
                    </a>
                  ) : null}
                  <Link
                    href={`/book?branch=${branch.id}`}
                    className="flex flex-1 items-center justify-center rounded-[6px] bg-[#D4B57A] py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#031B16]"
                  >
                    Book
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
