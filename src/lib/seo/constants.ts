export const SITE_DOMAIN = "https://cradlewellnessliving.com";
export const BUSINESS_NAME = "Cradle Wellness Living";
export const BUSINESS_FULL_NAME = "Cradle Massage & Wellness Spa";
export const BUSINESS_TAGLINE =
  "Massage, Spa & Home Service Wellness in Bacolod";
export const DEFAULT_DESCRIPTION =
  "Book relaxing massage, spa, and wellness services with Cradle Wellness Living in Bacolod. Visit our branches or schedule a convenient home service appointment.";
export const DEFAULT_OG_IMAGE = "/images/spa/cta-banner.jpg";
export const DEFAULT_OG_IMAGE_ALT =
  "Cradle Wellness Living — Massage and spa services in Bacolod";
export const LOCATION = "Bacolod City, Philippines";

export const PUBLIC_PAGES = [
  { path: "/", priority: 1.0 },
  { path: "/services", priority: 0.9 },
  { path: "/book", priority: 0.9 },
  { path: "/branches", priority: 0.8 },
  { path: "/about", priority: 0.8 },
  { path: "/contact", priority: 0.8 },
  { path: "/products", priority: 0.6 },
  { path: "/home-service-massage-bacolod", priority: 0.85 },
  { path: "/massage-spa-bacolod", priority: 0.85 },
] as const;

export const BLOCKED_PATHS = [
  "/owner",
  "/manager",
  "/crm",
  "/staff-portal",
  "/api",
  "/login",
  "/register",
  "/dashboard",
] as const;

export const CORE_KEYWORDS = [
  "Cradle Wellness Living",
  "Cradle Massage and Wellness Spa",
  "massage spa Bacolod",
  "wellness spa Bacolod",
  "home service massage Bacolod",
  "book massage Bacolod",
  "spa services Bacolod",
  "Bacolod massage",
  "Bacolod wellness spa",
  "in-spa booking Bacolod",
  "home service massage",
] as const;
