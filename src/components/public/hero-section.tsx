import Link from "next/link";
import { ArrowRight, CheckCircle2, Home, ShieldCheck, Stars } from "lucide-react";
import { BookNowButton } from "@/components/public/book-now-button";
import { SpaVisual } from "@/components/public/spa-visual";

const heroTrustItems = [
  "Instant confirmation",
  "Home service available",
  "Choose therapist or any available",
  "Staff-managed rescheduling",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#f6e3a1]/18">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,246,220,0.24),transparent_40%),radial-gradient(circle_at_20%_20%,rgba(214,168,79,0.24),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(38,25,17,0.94),rgba(24,16,11,0.84)_46%,rgba(20,13,9,0.92))]" />
      <div className="spa-fade-up relative mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1.08fr_0.92fr] md:py-14">
        <div className="space-y-5">
          <p className="inline-flex items-center rounded-full border border-[#f6e3a1]/35 bg-[#f6e3a1]/10 px-3 py-1 text-[11px] tracking-[0.18em] text-[#f6e3a1] uppercase">
            Bacolod Premium Wellness
          </p>
          <h1 className="font-heading text-3xl leading-tight font-semibold text-[#fff7e7] sm:text-4xl md:text-5xl">
            Premium massage &amp; wellness booking in under 60 seconds.
          </h1>
          <p className="max-w-xl text-base text-[#fdf3dc]/84 sm:text-lg">
            Book in-spa or home service appointments, choose your preferred therapist,
            or let us assign the best available specialist.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <BookNowButton
              size="lg"
              className="h-11 rounded-full bg-[#d6a84f] px-6 font-semibold text-[#1f140d] shadow-[0_14px_28px_rgba(214,168,79,0.33)] hover:bg-[#e7c873]"
            >
              Book Appointment
            </BookNowButton>
            <Link
              href="/services"
              className="inline-flex h-11 items-center rounded-full border border-[#f6e3a1]/45 bg-[#1b120c]/50 px-5 text-sm font-medium text-[#f8ecd1] transition hover:border-[#f6e3a1]/80 hover:bg-[#241810]/70"
            >
              View Services <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {heroTrustItems.map((item, index) => (
              <li key={item} className="flex items-center gap-2 rounded-full border border-[#f6e3a1]/18 bg-[#2a1c13]/55 px-3 py-1.5 text-sm text-[#f6e3a1]/90">
                {index === 1 ? (
                  <Home className="h-4 w-4 text-[#e7c873]" />
                ) : index === 0 ? (
                  <ShieldCheck className="h-4 w-4 text-[#e7c873]" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-[#e7c873]" />
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-3 rounded-3xl border border-[#f6e3a1]/18 bg-[linear-gradient(180deg,rgba(27,18,12,0.84),rgba(22,15,10,0.74))] p-4 shadow-[0_20px_46px_rgba(10,6,4,0.48)]">
          <SpaVisual
            title="Spa Atmosphere"
            caption="Calm lighting, aromatherapy, and private treatment suites."
          />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-[#f6e3a1]/18 bg-[#24180f]/65 p-2.5 text-[#f7ebcd]">
              <p className="font-semibold">Private rooms</p>
            </div>
            <div className="rounded-xl border border-[#f6e3a1]/18 bg-[#24180f]/65 p-2.5 text-[#f7ebcd]">
              <p className="font-semibold">Home service available</p>
            </div>
            <div className="rounded-xl border border-[#f6e3a1]/18 bg-[#24180f]/65 p-2.5 text-[#f7ebcd]">
              <p className="font-semibold">Auto-confirmed booking</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#f6e3a1]/18 bg-[#20150f]/70 p-3 text-sm text-[#f6e3a1]/86">
            <p className="inline-flex items-center gap-2 font-semibold">
              <Stars className="h-4 w-4 text-[#e7c873]" />
              Luxury care, faster booking
            </p>
            <p className="mt-1 text-xs text-[#f6e3a1]/74">
              High-touch service quality with staff-assisted scheduling support.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-[#f6e3a1]/15 bg-[#251910]/55 p-2">
              <p className="text-[#e7c873]">4-step flow</p>
              <p className="text-[#f7edcf]/80">Fast booking wizard</p>
            </div>
            <div className="rounded-lg border border-[#f6e3a1]/15 bg-[#251910]/55 p-2">
              <p className="text-[#e7c873]">Staff support</p>
              <p className="text-[#f7edcf]/80">Reschedule help</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
