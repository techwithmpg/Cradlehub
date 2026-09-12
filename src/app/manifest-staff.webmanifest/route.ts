export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "cradlehub-staff",
    name: "CradleHub Staff",
    short_name: "Staff",
    description: "CradleHub Staff Operational Team Workspace",
    start_url: "/staff-portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F3EB",
    theme_color: "#163A2B",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/manifest-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/manifest-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
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
