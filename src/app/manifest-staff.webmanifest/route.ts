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
    background_color: "#F7F3EB",
    theme_color: "#163A2B",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/staff-manifest-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/staff-manifest-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
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
