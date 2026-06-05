"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MobileFadeUp } from "@/components/public/mobile/mobile-scroll-effects";

export type FaqItem = {
  question: string;
  answer: string;
};

type Props = {
  items: FaqItem[];
  revealItems?: boolean;
};

export function FaqAccordion({ items, revealItems = false }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex((current) => (current === index ? null : index));
  }

  return (
    <div className="flex flex-col">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const borderClass =
          index < items.length - 1 ? "border-b border-[#E8D5A3]/25" : "";
        const itemContent = (
          <div className={borderClass}>
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${index}`}
              className="flex w-full items-center justify-between gap-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]/50 rounded-sm"
            >
              <span className="text-[13px] font-semibold text-[#022316] md:text-[15px]">
                {item.question}
              </span>
              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 text-[#B68A3C] transition-transform duration-300",
                  isOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden="true"
              />
            </button>
            <div
              id={`faq-answer-${index}`}
              className={[
                "grid transition-all duration-300",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              ].join(" ")}
            >
              <div className="overflow-hidden">
                <p className="pb-4 text-[11px] leading-5 text-[#5F6F63] md:text-[14px] md:leading-6">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );

        return revealItems ? (
          <MobileFadeUp key={item.question}>{itemContent}</MobileFadeUp>
        ) : (
          <div key={item.question} className="contents">
            {itemContent}
          </div>
        );
      })}
    </div>
  );
}
