import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Home, Sparkles, type LucideIcon } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

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
    <section className="px-4 pt-2">
      <div className="mb-3.5 text-center">
        <h2 className="text-[17px] font-semibold text-[#022316]">
          Choose Your Experience
        </h2>
        <p className="mt-1 text-[11.5px] text-[#5F6F63]">
          How would you like to be cared for today?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(({ Icon, title, body, href, image }) => (
          <Link
            key={title}
            href={href}
            className="group relative h-[190px] overflow-hidden rounded-[22px]"
          >
            <Image
              src={image}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 200px"
            />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,15,10,0.90)_0%,rgba(3,27,18,0.38)_60%,rgba(2,15,10,0.10)_100%)]" />

            <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#022316]/80 backdrop-blur-sm">
              <Icon className="h-4 w-4 text-[#E0B84B]" aria-hidden="true" />
            </span>

            <div className="absolute inset-x-3 bottom-3 text-[#FCFAF5]">
              <p className="text-[13px] font-bold leading-tight">{title}</p>
              <p className="mt-1 text-[10px] leading-[1.45] text-[#FCFAF5]/76">
                {body}
              </p>
              <ArrowRight
                className="mt-2 h-3.5 w-3.5 text-[#E0B84B]"
                aria-hidden="true"
              />
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-2.5 text-center text-[10px] text-[#9AA89A]">
        Available from participating branches.
      </p>
    </section>
  );
}
