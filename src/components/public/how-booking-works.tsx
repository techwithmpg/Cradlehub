import { bookingSteps } from "@/lib/public/public-site-data";
import { BookNowButton } from "@/components/public/book-now-button";
import { CalendarDays, ClipboardCheck, UserRoundSearch, WandSparkles } from "lucide-react";

const stepIcons = [WandSparkles, UserRoundSearch, CalendarDays, ClipboardCheck] as const;

export function HowBookingWorks() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-12">
      <div className="rounded-3xl border border-[#f6e3a1]/16 bg-[linear-gradient(145deg,rgba(44,30,21,0.82),rgba(24,17,12,0.78))] p-5 md:p-7">
        <h2 className="font-heading text-2xl font-semibold text-[#fff6df] md:text-3xl">How booking works</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[#f8ecd1]/78 md:text-base">
          The full booking flow is designed for speed and clarity, from service selection to
          confirmation.
        </p>
        <div className="mt-5 grid gap-2.5 md:hidden">
          {bookingSteps.map((step, index) => (
            <article
              key={step.id}
              className="rounded-xl border border-[#f6e3a1]/18 bg-[#261a12]/70 p-3"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e7c873]/18 text-xs font-semibold text-[#f6e3a1]">
                  {index + 1}
                </span>
                <h3 className="text-sm font-semibold text-[#fff6de]">{step.title}</h3>
              </div>
              <p className="text-xs leading-relaxed text-[#f8ecd1]/78">{step.detail}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 hidden md:block">
          <div className="grid grid-cols-4 gap-4">
            {bookingSteps.map((step, index) => {
              const Icon = stepIcons[index] ?? WandSparkles;
              return (
                <article key={step.id} className="relative">
                  {index < bookingSteps.length - 1 && (
                    <span className="absolute top-6 left-[calc(100%_-_0.5rem)] h-px w-[calc(100%_-_0.5rem)] bg-gradient-to-r from-[#f6e3a1]/40 to-[#f6e3a1]/10" />
                  )}
                  <div className="space-y-2 rounded-2xl border border-[#f6e3a1]/18 bg-[#251910]/62 p-4">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f6e3a1]/35 bg-[#e7c873]/15 text-[#f6e3a1]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs tracking-[0.14em] text-[#e7c873] uppercase">Step {index + 1}</p>
                    <h3 className="font-heading text-xl font-semibold text-[#fff6de]">{step.title}</h3>
                    <p className="text-sm text-[#f8ecd1]/78">{step.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="mt-5">
          <BookNowButton className="h-10 rounded-full bg-[#d6a84f] px-5 text-sm font-semibold text-[#1f130c] hover:bg-[#e7c873]">
            Start Booking
          </BookNowButton>
        </div>
      </div>
    </section>
  );
}
