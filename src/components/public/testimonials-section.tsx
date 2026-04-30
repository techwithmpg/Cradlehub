import { faqEntries, testimonials } from "@/lib/public/public-site-data";

export function TestimonialsSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-12">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-[#fff6de] md:text-3xl">
            Client Reviews
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[#f8ecd1]/78 md:text-base">
            Realistic sample testimonials for now. Final client reviews can be connected later.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {testimonials.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-[#f6e3a1]/16 bg-[linear-gradient(170deg,rgba(39,27,18,0.76),rgba(25,18,13,0.72))] p-4 shadow-[0_10px_26px_rgba(9,6,4,0.18)]"
              >
                <p className="text-sm font-medium text-[#e7c873]">{review.highlight}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#f8ecd1]/80">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <p className="mt-2 text-xs tracking-[0.18em] text-[#f6e3a1]/58 uppercase">
                  {review.customer}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl border border-[#f6e3a1]/16 bg-[linear-gradient(180deg,rgba(38,26,18,0.75),rgba(24,17,12,0.7))] p-5">
          <h2 className="font-heading text-xl font-semibold text-[#fff6de] md:text-2xl">Frequently Asked</h2>
          <div className="mt-3 space-y-2.5">
            {faqEntries.map((faq) => (
              <details
                key={faq.question}
                className="rounded-xl border border-[#f6e3a1]/16 bg-[#261a12]/55 px-3.5 py-3"
              >
                <summary className="cursor-pointer list-none text-sm font-medium text-[#f8ecd1]">
                  {faq.question}
                </summary>
                <p className="mt-2 text-sm text-[#f8ecd1]/72">{faq.answer}</p>
              </details>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
