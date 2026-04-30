import Link from "next/link";
import { MapPin, MessageCircleMore, PhoneCall, TimerReset } from "lucide-react";
import { BookNowButton } from "@/components/public/book-now-button";
import { contactInfo } from "@/lib/public/public-site-data";

export function ContactCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-12">
      <div className="rounded-3xl border border-[#f6e3a1]/20 bg-[linear-gradient(135deg,rgba(246,227,161,0.18),rgba(231,200,115,0.11),rgba(34,23,15,0.85)_60%)] p-6 md:p-7">
        <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-[#fff7e2] md:text-3xl">
              Ready to book your session?
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-[#f8ecd1]/80 md:text-base">
              Choose your service, pick your therapist, and secure your schedule in minutes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <BookNowButton className="h-11 rounded-full bg-[#d6a84f] px-6 font-semibold text-[#1f130c] hover:bg-[#e7c873]">
                Book Now
              </BookNowButton>
              <Link
                href={contactInfo.whatsappHref}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#f6e3a1]/45 bg-[#23160e]/55 px-5 text-sm font-medium text-[#f8ecd1] hover:border-[#f6e3a1]/75 hover:bg-[#2a1b12]/75"
              >
                <MessageCircleMore className="h-4 w-4" />
                {contactInfo.whatsappLabel}
              </Link>
            </div>
          </div>
          <div className="space-y-2.5 rounded-2xl border border-[#f6e3a1]/20 bg-[#23170f]/72 p-4 text-sm text-[#f8ecd1]/84">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#e7c873]" />
              {contactInfo.address}
            </p>
            <p className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-[#e7c873]" />
              <Link href={contactInfo.phoneHref} className="hover:text-[#fff6de]">
                {contactInfo.phoneLabel}
              </Link>
            </p>
            <p className="flex items-center gap-2">
              <TimerReset className="h-4 w-4 text-[#e7c873]" />
              {contactInfo.hours}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
