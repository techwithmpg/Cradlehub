import Image from "next/image";
import Link from "next/link";
import { Home, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

const trustItems = [
  { label: "Professional Therapists", Icon: Users },
  { label: "Premium Care", Icon: Sparkles },
  { label: "Clean & Safe Environment", Icon: ShieldCheck },
  { label: "Trusted by Our Clients", Icon: Star },
] as const;

export function PublicMobileHome() {
  return (
    <div className="md:hidden bg-[#F7F1E7] pb-24 pt-14 text-[#10261D]">
      <section>
        <div className="relative h-[350px] overflow-hidden">
          <Image
            src={SPA_IMAGES.hero}
            alt="Relaxing Cradle massage treatment"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,38,29,0.82)_0%,rgba(16,38,29,0.24)_58%,rgba(16,38,29,0.08)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-7 text-[#FCFAF5]">
            <h1
              className="text-[34px] font-medium leading-[1.04]"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Rest. Renew.
              <br />
              Rejuvenate.
            </h1>
            <p className="mt-3 max-w-[260px] text-[14px] leading-6 text-[#FCFAF5]/86">
              Experience the healing touch of Cradle.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/book"
                className="flex min-h-12 items-center justify-center rounded-[7px] bg-[#063D2D] text-[12px] font-semibold uppercase tracking-[0.12em] text-[#FCFAF5]"
              >
                Book Now
              </Link>
              <Link
                href="/services"
                className="flex min-h-12 items-center justify-center rounded-[7px] bg-[#F8EED8] text-[12px] font-semibold uppercase tracking-[0.12em] text-[#10261D]"
              >
                Our Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="-mt-1 rounded-t-[24px] bg-[#FBF6EC] px-4 pb-6 pt-5 shadow-[0_-8px_24px_rgba(16,38,29,0.08)]">
        <div className="text-center">
          <h2 className="text-[18px] font-semibold">Choose Your Experience</h2>
          <p className="mt-2 text-[12px] text-[#5F6F63]">
            How would you like to be cared for today?
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/book"
            className="rounded-[10px] border border-[#E9DDC8] bg-white p-4 text-center shadow-[0_8px_18px_rgba(16,38,29,0.05)]"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F6E8C8] text-[#10261D]">
              <Sparkles className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-[14px] font-semibold">In-Spa</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#5F6F63]">
              Visit our spa and enjoy our facilities.
            </p>
          </Link>

          <Link
            href="/book"
            className="rounded-[10px] border border-[#E9DDC8] bg-[#F5EFE4] p-4 text-center shadow-[0_8px_18px_rgba(16,38,29,0.04)]"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F6E8C8] text-[#10261D]">
              <Home className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-[14px] font-semibold">Home Service</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#5F6F63]">
              We come to you for your convenience.
            </p>
          </Link>
        </div>
      </section>

      <section className="bg-[#082E22] px-3 py-4 text-[#F8EED8]">
        <div className="grid grid-cols-4 gap-2">
          {trustItems.map(({ label, Icon }) => (
            <div key={label} className="text-center">
              <Icon className="mx-auto h-5 w-5 text-[#C8A96B]" aria-hidden="true" />
              <p className="mt-2 text-[9.5px] font-medium leading-4">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-6">
        <div className="overflow-hidden rounded-[14px] border border-[#E8DDCA] bg-[#FCFAF5] shadow-[0_8px_22px_rgba(16,38,29,0.08)]">
          <div className="relative h-[142px]">
            <Image
              src={SPA_IMAGES.about}
              alt="Inside the Cradle spa experience"
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,38,29,0.58),rgba(16,38,29,0.08))]" />
          </div>
          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B68A3C]">
              Inside Cradle
            </p>
            <h2 className="mt-1 text-[17px] font-semibold">
              Inside the Cradle Experience
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[#5F6F63]">
              Step into a calming space designed for rest, recovery, and everyday renewal.
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[#5F6F63]">
              From soothing treatments to thoughtful details, every part of Cradle is created to help you feel cared for.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
