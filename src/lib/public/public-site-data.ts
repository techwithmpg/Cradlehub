export type PublicService = {
  id: string;
  name: string;
  benefit: string;
  durationMinutes: number;
  priceFrom: number;
  imageAlt: string;
  serviceMode: "both" | "in_spa" | "home_service";
  homeServiceEligible: boolean;
};

export type PublicTherapist = {
  id: string;
  name: string;
  tier: "senior" | "mid" | "junior";
  focus: string;
};

export type TrustPoint = {
  id: string;
  label: string;
  detail: string;
};

export type Testimonial = {
  id: string;
  customer: string;
  highlight: string;
  quote: string;
};

export type BookingStep = {
  id: string;
  title: string;
  detail: string;
};

export type ExperienceCard = {
  id: string;
  title: string;
  detail: string;
};

export type FaqEntry = {
  question: string;
  answer: string;
};

export const publicServices: PublicService[] = [
  {
    id: "signature-massage",
    name: "Signature Massage",
    benefit: "Balanced relaxation and deep release for full-body renewal.",
    durationMinutes: 90,
    priceFrom: 1800,
    imageAlt: "Relaxing signature massage room ambiance",
    serviceMode: "both",
    homeServiceEligible: true,
  },
  {
    id: "hot-stone-therapy",
    name: "Hot Stone Therapy",
    benefit: "Heated stones melt tension and improve circulation.",
    durationMinutes: 75,
    priceFrom: 2200,
    imageAlt: "Hot stones prepared for therapy treatment",
    serviceMode: "in_spa",
    homeServiceEligible: false,
  },
  {
    id: "swedish-massage",
    name: "Swedish Massage",
    benefit: "Gentle pressure to calm stress and improve sleep quality.",
    durationMinutes: 60,
    priceFrom: 1300,
    imageAlt: "Soft lighting and wellness oils for Swedish massage",
    serviceMode: "both",
    homeServiceEligible: true,
  },
  {
    id: "deep-tissue-massage",
    name: "Deep Tissue Massage",
    benefit: "Targeted relief for persistent tightness and muscle fatigue.",
    durationMinutes: 90,
    priceFrom: 2100,
    imageAlt: "Therapist applying deep tissue pressure technique",
    serviceMode: "both",
    homeServiceEligible: true,
  },
  {
    id: "couple-massage",
    name: "Couple Massage",
    benefit: "Shared premium treatment in a private couples suite.",
    durationMinutes: 90,
    priceFrom: 3600,
    imageAlt: "Luxury room setup for couple massage session",
    serviceMode: "in_spa",
    homeServiceEligible: false,
  },
  {
    id: "home-service-massage",
    name: "Home Service Massage",
    benefit: "Spa-quality treatment delivered to your location.",
    durationMinutes: 90,
    priceFrom: 2500,
    imageAlt: "Professional massage setup for home service",
    serviceMode: "home_service",
    homeServiceEligible: true,
  },
];

export const publicTherapists: PublicTherapist[] = [
  {
    id: "any-available",
    name: "Any Available Therapist",
    tier: "senior",
    focus: "Fastest match based on real-time availability",
  },
  {
    id: "therapist-amara",
    name: "Amara Velasco",
    tier: "senior",
    focus: "Deep tissue and posture recovery",
  },
  {
    id: "therapist-lian",
    name: "Lian Cortez",
    tier: "mid",
    focus: "Relaxation and stress reset",
  },
  {
    id: "therapist-jules",
    name: "Jules Dizon",
    tier: "junior",
    focus: "Light restorative pressure and circulation work",
  },
];

export const trustPoints: TrustPoint[] = [
  {
    id: "instant-confirmation",
    label: "Instant confirmation",
    detail: "Online bookings are auto-confirmed as soon as details are complete.",
  },
  {
    id: "home-service",
    label: "Home service available",
    detail: "Book in-spa or request therapist dispatch to your location.",
  },
  {
    id: "therapist-choice",
    label: "Choose therapist or any available",
    detail: "Pick a preferred specialist or let us assign the best available fit.",
  },
  {
    id: "staff-managed-edits",
    label: "Staff-managed rescheduling",
    detail: "Our team can assist updates, edits, and scheduling support.",
  },
];

export const bookingSteps: BookingStep[] = [
  {
    id: "step-service",
    title: "Choose service",
    detail: "Select from premium massage and wellness treatments.",
  },
  {
    id: "step-therapist",
    title: "Choose therapist or any available",
    detail: "Pick your preferred specialist or let us assign one instantly.",
  },
  {
    id: "step-time",
    title: "Pick date and time",
    detail: "Select your preferred schedule from available time slots.",
  },
  {
    id: "step-confirm",
    title: "Confirm booking",
    detail: "Review your details and receive immediate confirmation.",
  },
];

export const experienceCards: ExperienceCard[] = [
  {
    id: "professional-therapists",
    title: "Professional therapists",
    detail: "Experienced specialists trained for therapeutic and relaxation outcomes.",
  },
  {
    id: "clean-environment",
    title: "Clean, calming environment",
    detail: "Quiet treatment rooms and premium hygiene standards every session.",
  },
  {
    id: "home-support",
    title: "Home service support",
    detail: "Wellness convenience for clients who prefer treatment at home.",
  },
  {
    id: "staff-assistance",
    title: "Staff-assisted booking edits",
    detail: "Walk-ins, rescheduling, and updates are handled by our operations team.",
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "review-1",
    customer: "Elaine S.",
    highlight: "Executive wellness reset",
    quote:
      "The booking process was fast, and the treatment quality felt like a five-star retreat.",
  },
  {
    id: "review-2",
    customer: "Marcus R.",
    highlight: "Deep tissue recovery",
    quote:
      "I picked my therapist, arrived on time, and got one of the best deep tissue sessions I have had.",
  },
  {
    id: "review-3",
    customer: "Celine P.",
    highlight: "Home service convenience",
    quote:
      "Home service was smooth and professional. It felt premium from booking to treatment.",
  },
];

export const faqEntries: FaqEntry[] = [
  {
    question: "Are online bookings instantly confirmed?",
    answer:
      "Yes. Once details are complete, your booking is auto-confirmed and visible to staff immediately.",
  },
  {
    question: "Can I choose a specific therapist?",
    answer:
      "Yes. You can select a preferred therapist or choose Any Available Therapist for the fastest slot.",
  },
  {
    question: "Can I cancel online after booking?",
    answer:
      "Public cancellation is not available. Please contact the spa and our staff can assist with changes.",
  },
];

export const contactInfo = {
  spaName: "Cradle Massage & Wellness Spa",
  phoneLabel: "+63 917 000 1234",
  phoneHref: "tel:+639170001234",
  whatsappLabel: "Chat on WhatsApp",
  whatsappHref: "https://wa.me/639170001234",
  address: "Bacolod City, Negros Occidental, Philippines",
  hours: "Daily 10:00 AM - 10:00 PM",
};

export const bookingTimeSlots = [
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "16:00",
  "18:00",
  "19:00",
  "20:00",
] as const;
