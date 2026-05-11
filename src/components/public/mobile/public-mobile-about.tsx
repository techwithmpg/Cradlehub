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

export function PublicMobileAbout() {
  return (
    <div className="md:hidden bg-[#FBF6EC] pb-12 pt-14 text-[#10261D]">
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
        <div className="rounded-t-[18px] bg-[#FCFAF5] p-5 shadow-[0_-8px_22px_rgba(16,38,29,0.1)]">
          <h2 className="text-[17px] font-semibold">Our Story</h2>
          <p className="mt-3 text-[13px] leading-6 text-[#3F4F44]">
            Cradle Massage & Wellness Spa was created to be your personal escape from
            the busy world. We provide a safe space where you can relax, reset, and
            feel cared for.
          </p>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {values.map(({ label, Icon }) => (
              <div key={label} className="text-center">
                <Icon className="mx-auto h-6 w-6 text-[#B68A3C]" aria-hidden="true" />
                <p className="mt-2 text-[10px] font-medium leading-4">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#082E22] px-5 py-6 text-center text-[#FCFAF5]">
        <p className="text-[15px] font-semibold">Ready to experience Cradle?</p>
        <Link
          href="/book"
          className="mx-auto mt-4 flex min-h-11 max-w-[230px] items-center justify-center rounded-[7px] border border-[#C8A96B] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F8EED8]"
        >
          Book Your Session
        </Link>
      </section>
    </div>
  );
}
