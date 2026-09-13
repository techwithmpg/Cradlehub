import { describe, expect, it } from "vitest";
import { GET as getStaffManifest } from "@/app/manifest-staff.webmanifest/route";
import { readFileSync } from "fs";

describe("Staff PWA native standalone launch contract", () => {
  it("keeps the installed app identity anchored to the canonical Staff scope", async () => {
    const response = getStaffManifest();
    const manifest = JSON.parse(await response.text());

    expect(manifest.id).toBe("/cradlehub-staff");
    expect(manifest.start_url).toBe("/staff/");
    expect(manifest.scope).toBe("/staff/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.display_override).toEqual(["standalone"]);
    expect(manifest.prefer_related_applications).toBe(false);
  });

  it("uses a dedicated /staff/ registration without introducing caching", () => {
    const registrationSource = readFileSync(
      "src/components/features/staff-pwa/staff-service-worker-registration.tsx",
      "utf8",
    );
    const workerSource = readFileSync("public/staff-sw.js", "utf8");

    expect(registrationSource).toContain('register("/staff-sw.js"');
    expect(registrationSource).toContain('scope: "/staff/"');
    expect(registrationSource).toContain('updateViaCache: "none"');
    expect(workerSource).toContain("self.skipWaiting()");
    expect(workerSource).toContain("self.clients.claim()");
    expect(workerSource).not.toContain("caches.open");
    expect(workerSource).not.toContain("addEventListener(\"fetch\"");
  });

  it("mounts registration inside the canonical Staff layout", () => {
    const layoutSource = readFileSync("src/app/(dashboard)/staff/layout.tsx", "utf8");

    expect(layoutSource).toContain("StaffServiceWorkerRegistration");
    expect(layoutSource).toContain("<StaffServiceWorkerRegistration />");
  });

  it("hides the install prompt after the browser confirms installation", () => {
    const promptSource = readFileSync(
      "src/components/features/staff-pwa/install-prompt.tsx",
      "utf8",
    );

    expect(promptSource).toContain('window.addEventListener("beforeinstallprompt"');
    expect(promptSource).toContain('window.addEventListener("appinstalled"');
    expect(promptSource).toContain('window.matchMedia("(display-mode: standalone)")');
    expect(promptSource).toContain('"standalone" in window.navigator');
    expect(promptSource).toContain("isInstalled");
  });
});
