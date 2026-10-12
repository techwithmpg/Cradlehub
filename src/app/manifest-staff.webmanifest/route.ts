export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/cradlehub-staff",
    name: "Cradle Hub",
    short_name: "Cradle Hub",
    description: "Cradle Hub — Team Workspace",
    start_url: "/staff/",
    scope: "/staff/",
    display: "standalone",
    display_override: ["standalone"],
    prefer_related_applications: false,
    orientation: "portrait",
    background_color: "#163A2B",
    theme_color: "#163A2B",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/staff-pwa-icon-192-gold.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/staff-pwa-icon-512-gold.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/staff-pwa-icon-maskable-192-gold.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/staff-pwa-icon-maskable-512-gold.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
