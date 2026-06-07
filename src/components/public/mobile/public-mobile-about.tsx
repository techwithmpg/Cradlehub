import Image from "next/image";
import Link from "next/link";
import { Flower2, HeartHandshake, Leaf, Sparkles } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

const values = [
  { label: "Healing Touch", Icon: Leaf },
  { label: "Premium Care", Icon: Sparkles },
  { label: "Peaceful Space", Icon: Flower2 },
  { label: "Heartfelt Service", Icon: HeartHandshake },
] as const;

const MOBILE_PUBLIC_SURFACE =
  "md:hidden bg-[radial-gradient(circle_at_80%_8%,rgba(212,181,122,0.10),transparent_34%),linear-gradient(180deg,#031B16_0%,#05241D_50%,#02140F_100%)] pb-12 pt-14 text-[#F6EBD6]";
const MOBILE_GLASS_CARD =
  "box-border border border-[#D4B57A]/22 bg-[#0D2B20]/72 shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";

export function PublicMobileAbout() {
  return (
    <div className={MOBILE_PUBLIC_SURFACE}>
      <section className="relative h-[270px] overflow-hidden bg-[#10261D]">
        <Image
          src={SPA_IMAGES.aboutSecondary}
          alt="Candles, towels, and oils inside Cradle"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#10261D]/50" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 text-center text-[#FCFAF5]">
          <h1
            className="text-[30px] font-medium leading-tight"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            About Cradle
          </h1>
          <p className="mt-2 text-[13px] text-[#FCFAF5]/84">
            Your wellness is our passion.
          </p>
        </div>
      </section>

      <section className="-mt-5 px-4">
        <div className={`rounded-t-[18px] p-5 ${MOBILE_GLASS_CARD}`}>
          <h2 className="text-[17px] font-semibold text-[#F6EBD6]">Our Story</h2>
          <p className="mt-3 text-[13px] leading-6 text-[#F6EBD6]/70">
            Cradle Massage & Wellness Spa was created to be your personal escape from
            the busy world. We provide a safe space where you can relax, reset, and
            feel cared for.
          </p>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {values.map(({ label, Icon }) => (
              <div key={label} className="text-center">
                <Icon className="mx-auto h-6 w-6 text-[#D4B57A]" aria-hidden="true" />
                <p className="mt-2 text-[10px] font-medium leading-4 text-[#F6EBD6]/82">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-6 text-center text-[#FCFAF5]">
        <p className="text-[15px] font-semibold">Ready to experience Cradle?</p>
        <Link
          href="/book"
          className="mx-auto mt-4 flex min-h-11 max-w-[230px] items-center justify-center rounded-[7px] border border-[#D4B57A]/60 bg-[#031B16]/50 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F8EED8] backdrop-blur-md"
        >
          Book Your Session
        </Link>
      </section>
    </div>
  );
}
