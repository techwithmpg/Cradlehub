import { SPA_IMAGES } from "./spa-images";
import type { ShowcaseSlide } from "@/components/public/service-showcase-carousel";

export const SERVICE_SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: "swedish",
    title: "Swedish Massage",
    description: "Gentle, flowing strokes to ease tension and restore circulation.",
    image: SPA_IMAGES.swedish,
    href: "/services#massage-services",
  },
  {
    id: "deep-tissue",
    title: "Deep Tissue",
    description: "Targeted pressure to release chronic muscle tension and knots.",
    image: SPA_IMAGES.deepTissue,
    href: "/services#massage-services",
  },
  {
    id: "aromatherapy",
    title: "Aromatherapy",
    description: "Essential oils blended to calm your mind and body.",
    image: SPA_IMAGES.aromatherapy,
    href: "/services#skin-care-services",
  },
  {
    id: "hot-stone",
    title: "Hot Stone Therapy",
    description: "Warm basalt stones melt away deep stress and stiffness.",
    image: SPA_IMAGES.hotStone,
    href: "/services#massage-services",
  },
  {
    id: "reflexology",
    title: "Foot Reflexology",
    description: "Ancient healing art for full-body balance and relief.",
    image: SPA_IMAGES.reflexology,
    href: "/services#massage-services",
  },
  {
    id: "couples",
    title: "Couples Retreat",
    description: "Share a moment of calm and connection with someone special.",
    image: SPA_IMAGES.couples,
    href: "/services#divine-renewal-packages",
  },
];
