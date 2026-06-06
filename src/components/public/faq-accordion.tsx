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
  variant?: "light" | "dark";
};

export function FaqAccordion({
  items,
  revealItems = false,
  variant = "light",
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isDark = variant === "dark";

  function toggle(index: number) {
    setOpenIndex((current) => (current === index ? null : index));
  }

  return (
    <div className="flex flex-col">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const borderClass =
          index < items.length - 1
            ? `border-b ${isDark ? "border-[#C8A96A]/18" : "border-[#E8D5A3]/25"}`
            : "";
        const itemContent = (
          <div className={borderClass}>
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${index}`}
              className="flex w-full items-center justify-between gap-3 rounded-sm py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96B]/50"
            >
              <span
                className={`text-[13px] font-semibold md:text-[15px] ${
                  isDark ? "text-[#F5ECDD]" : "text-[#022316]"
                }`}
              >
                {item.question}
              </span>
              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 transition-transform duration-300",
                  isDark ? "text-[#D4B57A]" : "text-[#B68A3C]",
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
                <p
                  className={`pb-4 text-[11px] leading-5 md:text-[14px] md:leading-6 ${
                    isDark ? "text-[#EFE3CF]/72" : "text-[#5F6F63]"
                  }`}
                >
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
