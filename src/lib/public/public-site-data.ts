import { SPA_IMAGES } from "@/constants/spa-images";

export type PublicBranch = {
  id: string;
  name: string;
  area: string;
  mapHref?: string;
};

export type PublicPhone = {
  label: string;
  href: string;
};

export type PublicProofPoint = {
  id: string;
  label: string;
  detail: string;
};

export type PublicJourneyStep = {
  id: string;
  title: string;
  detail: string;
};

export type PublicSettingCard = {
  id: "in_spa" | "home_service";
  title: string;
  eyebrow: string;
  detail: string;
  points: string[];
  image: string;
  imageAlt: string;
};

export type PublicGalleryItem = {
  id: string;
  title: string;
  detail: string;
  image: string;
  imageAlt: string;
};

export type PublicTeamRole = {
  id: string;
  title: string;
  detail: string;
};

export const businessInfo = {
  brandName: "Cradle Massage & Wellness Spa",
  siteName: "CradleHub",
  location: "Bacolod",
  hours: "Daily availability through online booking",
  bookingHref: "/book",
  planHref: "#plan-your-visit",
};

export const publicPhones: PublicPhone[] = [
  { label: "0917 707 7070", href: "tel:+639177077070" },
  { label: "0909 008 7815", href: "tel:+639090087815" },
];

export const publicBranches: PublicBranch[] = [
  {
    id: "sm-city-bacolod",
    name: "SM City Bacolod",
    area: "Bacolod",
    mapHref: "https://maps.google.com/?q=SM+City+Bacolod",
  },
  {
    id: "la-luz",
    name: "La Luz Branch",
    area: "Bacolod",
    mapHref: "https://maps.google.com/?q=La+Luz+Branch+Bacolod",
  },
];

export const heroProofPoints: PublicProofPoint[] = [
  {
    id: "in-spa-home",
    label: "In-spa and home service",
    detail: "Choose the setting that fits your day.",
  },
  {
    id: "bacolod-branches",
    label: "Two Bacolod branches",
    detail: "SM City Bacolod and La Luz Branch.",
  },
  {
    id: "front-desk",
    label: "Front-desk support",
    detail: "The team can follow up when confirmation is needed.",
  },
];

export const quickTrustPoints: PublicProofPoint[] = [
  {
    id: "trained-team",
    label: "Trained wellness team",
    detail: "Thoughtful therapists for relaxation, tension relief, and everyday recovery.",
  },
  {
    id: "choice-setting",
    label: "In-spa or at home",
    detail: "Book a spa visit or request a home-service appointment in Bacolod.",
  },
  {
    id: "branch-access",
    label: "Bacolod branch access",
    detail: "Plan around SM City Bacolod or La Luz Branch availability.",
  },
  {
    id: "crm-support",
    label: "Assisted confirmation",
    detail: "CRM and front-desk staff can help with booking and payment follow-up.",
  },
];

export const bookingJourneySteps: PublicJourneyStep[] = [
  {
    id: "setting",
    title: "Choose your setting",
    detail: "Start with an in-spa visit or a home-service appointment.",
  },
  {
    id: "treatment",
    title: "Select your treatment",
    detail: "Pick the massage or wellness service that matches your need.",
  },
  {
    id: "schedule",
    title: "Pick date, time, and therapist",
    detail: "Choose from available slots and select a therapist when available.",
  },
  {
    id: "confirm",
    title: "Relax while we confirm",
    detail: "The front desk may follow up for payment or home-service details.",
  },
];

export const settingCards: PublicSettingCard[] = [
  {
    id: "in_spa",
    eyebrow: "Branch-based calm",
    title: "In-spa Experience",
    detail:
      "Settle into a quiet Cradle branch for a full self-care session with the spa environment around you.",
    points: ["Calm treatment rooms", "Best for longer reset sessions", "Available by branch schedule"],
    image: SPA_IMAGES.about,
    imageAlt: "Calm in-spa treatment room at Cradle",
  },
  {
    id: "home_service",
    eyebrow: "Wellness at home",
    title: "Home Service Experience",
    detail:
      "Request a therapist to come to your location when staying in feels better than traveling.",
    points: [
      "Address and landmark required",
      "Availability can differ from in-spa hours",
      "Front desk may follow up to confirm details",
    ],
    image: SPA_IMAGES.booking,
    imageAlt: "Prepared massage setup for home-service planning",
  },
];

export const galleryItems: PublicGalleryItem[] = [
  {
    id: "spa-room",
    title: "Spa room",
    detail: "Soft lighting and quiet treatment spaces.",
    image: SPA_IMAGES.about,
    imageAlt: "Spa treatment room with warm lighting",
  },
  {
    id: "massage-bed",
    title: "Massage bed",
    detail: "Prepared beds, clean linens, and calm details.",
    image: SPA_IMAGES.heroPortrait,
    imageAlt: "Prepared massage bed in a relaxing room",
  },
  {
    id: "oils-towels",
    title: "Oils and towels",
    detail: "Simple details that support a polished session.",
    image: SPA_IMAGES.aromatherapy,
    imageAlt: "Spa oils and towels prepared for treatment",
  },
  {
    id: "staff-prep",
    title: "Treatment preparation",
    detail: "A team-led experience from setup to confirmation.",
    image: SPA_IMAGES.contact,
    imageAlt: "Wellness preparation details at Cradle",
  },
  {
    id: "reception",
    title: "Front desk support",
    detail: "Booking assistance for in-spa and home service guests.",
    image: SPA_IMAGES.ctaBanner,
    imageAlt: "Calm spa reception mood",
  },
  {
    id: "home-setup",
    title: "Home-service setup",
    detail: "Comfort-led appointments planned around your location.",
    image: SPA_IMAGES.booking,
    imageAlt: "Home-service massage setup inspiration",
  },
];

export const whyGuestsChooseCradle: PublicProofPoint[] = [
  {
    id: "clean-calm",
    label: "Calm, clean environment",
    detail: "A warm spa setting designed for quiet recovery and rest.",
  },
  {
    id: "online-booking",
    label: "Online booking",
    detail: "A guided booking flow for branch, setting, services, schedule, and therapist.",
  },
  {
    id: "home-option",
    label: "Home-service option",
    detail: "Plan a session at home with address and landmark details collected upfront.",
  },
  {
    id: "local-branches",
    label: "Real Bacolod branches",
    detail: "Choose from SM City Bacolod or La Luz Branch when planning your visit.",
  },
];

export const teamRoles: PublicTeamRole[] = [
  {
    id: "senior-therapists",
    title: "Senior Therapists",
    detail: "Guide deeper relaxation and recovery-focused massage sessions.",
  },
  {
    id: "massage-specialists",
    title: "Massage Specialists",
    detail: "Support stress relief, muscle tension, and first-time guest comfort.",
  },
  {
    id: "home-service-team",
    title: "Home Service Team",
    detail: "Prepare practical details for appointments outside the branch.",
  },
  {
    id: "front-desk-crm",
    title: "Front Desk / CRM Support",
    detail: "Helps confirm bookings, payment follow-up, and appointment details.",
  },
];

export const guestReasons = [
  "Stress after work",
  "Muscle tension",
  "Recovery after travel",
  "Quiet self-care time",
  "Home-service comfort",
  "Couples or family relaxation",
] as const;

export const planningNotes = [
  "Choose In-spa or Home Service before selecting your treatment.",
  "Home Service requires a complete address and helpful landmark details.",
  "The CRM or front desk team may follow up for payment confirmation.",
  "Payment is manually confirmed for now until the official payment integration is ready.",
  "Keep your phone reachable after booking in case the team needs to confirm details.",
] as const;
