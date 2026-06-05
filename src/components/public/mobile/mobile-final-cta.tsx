import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";

export function MobileFinalCta() {
  return (
    <section className="px-4 pb-14 pt-12">
      <MobileFadeUp>
        <div className="relative min-h-[340px] overflow-hidden rounded-[34px] border border-[#C8A96A]/24 shadow-[0_26px_70px_rgba(0,0,0,0.32)]">
          <Image
            src={SPA_IMAGES.heroAmbience}
            alt="Cradle spa ambience with warm calm light"
            fill
            className="object-cover"
            sizes="calc(100vw - 32px)"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,17,12,0.88)_0%,rgba(4,17,12,0.56)_46%,rgba(4,17,12,0.18)_100%)]" />
          <div className="relative flex min-h-[340px] flex-col justify-end p-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]">
              Book your pause
            </p>
            <MobileScrollFloatHeading text="Your calm is waiting" />
            <p className="mt-4 max-w-[270px] text-[13px] leading-6 text-[#F3E9D2]/82">
              Choose a time, choose your setting, and let Cradle take care of
              the rest.
            </p>
            <div className="mt-7 grid gap-3">
              <Link
                href="/book"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#C8A96A] px-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#061912] shadow-[0_16px_34px_rgba(200,169,106,0.26)]"
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Book Appointment
              </Link>
              <Link
                href="/services"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#C8A96A]/55 bg-[#061912]/46 px-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#F3E9D2] backdrop-blur-md"
              >
                View Services
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </MobileFadeUp>
    </section>
  );
}
