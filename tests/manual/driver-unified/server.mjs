import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
const repo = fileURLToPath(new URL("../../../", import.meta.url))
    .replaceAll("\\", "/")
    .replace(/\/$/, ""),
  root = fileURLToPath(new URL(".", import.meta.url)).replaceAll("\\", "/"),
  require = createRequire(repo + "/package.json");
const viteUrl = pathToFileURL(
  createRequire(require.resolve("vitest/package.json")).resolve("vite")
).href;
const { createServer } = await import(viteUrl);
const mocks = [
  "@/app/(dashboard)/staff/scan/actions",
  "./driver-profile-sheet",
  "./driver-trip-alerts",
  "@/components/features/staff-pwa/safe-memory",
  "@/components/features/mobile-shell/mobile-retained-tab-host",
  "@/components/features/staff-pwa/driver/driver-dispatch-wake-listener",
  "@/components/features/staff-portal/driver/driver-profile-sheet",
  "@/components/features/staff-pwa/driver/driver-trip-alerts",
  "@/components/features/staff-portal/staff-attendance-clock-out",
  "@/app/(dashboard)/staff-portal/actions",
  "@/app/(dashboard)/staff/driver/map/live-location-action",
  "@/app/(dashboard)/staff/driver/routes/actions",
  "next/link",
  "next/navigation",
];
const config = {
  root,
  configFile: false,
  envDir: false,
  define: { "process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY": '""' },
  resolve: {
    alias: [
      ...mocks.map((find) => ({ find, replacement: root + "mocks.jsx" })),
      {
        find: "lucide-react",
        replacement: repo + "/node_modules/lucide-react/dist/esm/lucide-react.mjs",
      },
      { find: "@", replacement: repo + "/src" },
      { find: "react-dom/client", replacement: repo + "/node_modules/react-dom/client.js" },
      { find: "react", replacement: repo + "/node_modules/react" },
    ],
  },
  css: { postcss: { plugins: [require("@tailwindcss/postcss")()] } },
  oxc: { jsx: { runtime: "automatic" } },
  server: {
    host: "127.0.0.1",
    port: 4323,
    strictPort: true,
    fs: { allow: [root, repo, realpathSync(repo + "/node_modules").replaceAll("\\", "/")] },
  },
};
if (process.argv.includes("--build")) {
  const { build } = await import(viteUrl);
  await build({
    ...config,
    base: "./",
    build: {
      outDir: root + "dist",
      emptyOutDir: false,
      cssCodeSplit: false,
      assetsInlineLimit: 1000000,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
} else {
  const server = await createServer(config);
  await server.listen();
  console.log("LOCAL component preview http://127.0.0.1:4323");
}
