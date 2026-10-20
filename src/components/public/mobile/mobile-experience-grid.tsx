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

type MobileExperienceGridProps = {
  siteImages?: Record<string, string>;
};

export function MobileExperienceGrid({ siteImages }: MobileExperienceGridProps = {}) {
  const card0 = CARDS[0]!;
  const card1 = CARDS[1]!;
  const effectiveCards: Card[] = [
    {
      ...card0,
      image: siteImages?.home_setting_in_spa || card0.image,
    },
    {
      ...card1,
      image: siteImages?.home_setting_home_service || card1.image,
    },
  ];

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
        {effectiveCards.map(({ Icon, title, body, href, image }) => (
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-[#C8A96A]" />
                </div>
                <h3 className="mt-2 text-[14px] font-medium text-white">{title}</h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/70">{body}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#C8A96A]">
                  Book now
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}
