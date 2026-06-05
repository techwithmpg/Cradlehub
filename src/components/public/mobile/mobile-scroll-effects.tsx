"use client";

import {
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

function useCalmInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      const timeoutId = window.setTimeout(() => setIsVisible(true), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { rootMargin: "0px 0px -14% 0px", threshold: 0.18 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

type MobileFadeUpProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function MobileFadeUp({
  children,
  className,
  ...props
}: MobileFadeUpProps) {
  const { ref, isVisible } = useCalmInView();

  return (
    <div
      ref={ref}
      className={cn("mobile-fade-up", isVisible && "is-visible", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type MobileScrollFloatHeadingProps = {
  text: string;
  as?: "h2" | "h3";
  className?: string;
};

export function MobileScrollFloatHeading({
  text,
  as = "h2",
  className,
}: MobileScrollFloatHeadingProps) {
  const { ref, isVisible } = useCalmInView();
  const Heading: ElementType = as;
  const words = text.trim().split(/\s+/);

  return (
    <div ref={ref} className={cn("mobile-scroll-float", isVisible && "is-visible")}>
      <Heading
        aria-label={text}
        className={cn(
          "text-[30px] font-medium leading-[0.98] tracking-normal text-[#F3E9D2] [font-family:var(--sp-font-accent)]",
          className
        )}
      >
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            aria-hidden="true"
            className="mobile-scroll-float-word"
          >
            {word}
            {index < words.length - 1 ? "\u00a0" : ""}
          </span>
        ))}
      </Heading>
    </div>
  );
}
