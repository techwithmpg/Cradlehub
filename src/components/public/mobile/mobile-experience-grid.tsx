import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Home, Sparkles, type LucideIcon } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { MobileFadeUp } from "./mobile-scroll-effects";

type Card = {
  Icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  image: string;
};

const CARDS: Card[] = [
  {
    Icon: Sparkles,
    title: "In-Spa",
    body: "Visit our serene spa and indulge in pure relaxation.",
    href: "/book",
    image: SPA_IMAGES.couples,
  },
  {
    Icon: Home,
    title: "Home Service",
    body: "We bring the spa experience to your doorstep.",
    href: "/book",
    image: SPA_IMAGES.swedish,
  },
];

export function MobileExperienceGrid() {
  return (
    <section className="px-4 pt-8">
      <div className="mb-3.5 text-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
          First, choose your setting
        </p>
        <h2 className="text-[28px] font-medium leading-none text-[#F3E9D2] [font-family:var(--sp-font-accent)]">
          Choose Your Experience
        </h2>
        <p className="mx-auto mt-2 max-w-[260px] text-[12px] leading-5 text-[#D8CCB3]/82">
          How would you like to be cared for today?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(({ Icon, title, body, href, image }) => (
          <MobileFadeUp key={title}>
            <Link
              href={href}
              className="group relative block h-[198px] overflow-hidden rounded-[26px] border border-[#C8A96A]/18 shadow-[0_18px_38px_rgba(0,0,0,0.18)]"
            >
              <Image
                src={image}
                alt={title}
                fill
                className="object-cover transition-transform duration-700 group-active:scale-[1.03]"
                sizes="(max-width: 768px) 50vw, 200px"
              />
              <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,15,10,0.88)_0%,rgba(3,27,18,0.36)_60%,rgba(2,15,10,0.08)_100%)]" />

              <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#C8A96A]/24 bg-[#061912]/58 backdrop-blur-md">
                <Icon className="h-4 w-4 text-[#C8A96A]" aria-hidden="true" />
              </span>

              <div className="absolute inset-x-3 bottom-3 text-[#FCFAF5]">
                <p className="text-[15px] font-semibold leading-tight">
                  {title}
                </p>
                <p className="mt-1 text-[10px] leading-[1.5] text-[#FCFAF5]/78">
                  {body}
                </p>
                <ArrowRight
                  className="mt-2 h-3.5 w-3.5 text-[#C8A96A]"
                  aria-hidden="true"
                />
              </div>
            </Link>
          </MobileFadeUp>
        ))}
      </div>

      <p className="mt-3 text-center text-[10px] text-[#D8CCB3]/60">
        Available from participating branches.
      </p>
    </section>
  );
}
