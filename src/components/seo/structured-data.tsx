import { SITE_DOMAIN, BUSINESS_NAME, BUSINESS_FULL_NAME } from "@/lib/seo/constants";

function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BUSINESS_NAME,
    alternateName: BUSINESS_FULL_NAME,
    url: SITE_DOMAIN,
    logo: `${SITE_DOMAIN}/images/brand/cradle-logo-gold.png`,
    sameAs: [
      "https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web",
      "https://www.instagram.com/cradlewellnessliving",
      "https://www.instagram.com/cradlewellnessliving.smbacolod",
    ],
  };
  return <JsonLdScript data={data} />;
}

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BUSINESS_NAME,
    url: SITE_DOMAIN,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_DOMAIN}/services?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return <JsonLdScript data={data} />;
}

export function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HealthAndBeautyBusiness", "Spa"],
    name: BUSINESS_NAME,
    alternateName: BUSINESS_FULL_NAME,
    url: SITE_DOMAIN,
    telephone: ["+639177077070", "+639090087815"],
    areaServed: {
      "@type": "City",
      name: "Bacolod City",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Bacolod City",
        addressRegion: "Negros Occidental",
        addressCountry: "PH",
      },
    },
    serviceType: [
      "Massage",
      "Spa",
      "Wellness",
      "Home Service Massage",
      "Foot Spa",
      "Body Scrub",
    ],
    priceRange: "$$",
    image: `${SITE_DOMAIN}/images/spa/cta-banner.jpg`,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_DOMAIN}/book`,
      },
      name: "Book Appointment",
    },
  };
  return <JsonLdScript data={data} />;
}

export function ServiceJsonLd({
  serviceName,
  description,
  urlPath,
}: {
  serviceName: string;
  description: string;
  urlPath: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: serviceName,
    description,
    provider: {
      "@type": ["LocalBusiness", "HealthAndBeautyBusiness", "Spa"],
      name: BUSINESS_NAME,
      url: SITE_DOMAIN,
    },
    areaServed: {
      "@type": "City",
      name: "Bacolod City",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Bacolod City",
        addressRegion: "Negros Occidental",
        addressCountry: "PH",
      },
    },
    url: `${SITE_DOMAIN}${urlPath}`,
  };
  return <JsonLdScript data={data} />;
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_DOMAIN}${item.path}`,
    })),
  };
  return <JsonLdScript data={data} />;
}

export function FAQPageJsonLd({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
  return <JsonLdScript data={data} />;
}
