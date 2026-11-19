// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DriverApkPublicReleaseInfo } from "@/lib/driver/apk-distribution";
import { DriverAppDownloadDestination } from "@/components/features/driver/driver-app-download-card";

const AVAILABLE_RELEASE: DriverApkPublicReleaseInfo = {
  appName: "CradleHub Driver",
  iconPath: "/staff-pwa-icon-192-gold.png",
  available: true,
  statusLabel: "Available",
  unavailableReason: null,
  deliveryProvider: "google_drive",
  packageId: "com.mpgtechnologies.cradlehub.driver",
  versionName: "1.0.0",
  versionCode: 2,
  minAndroidVersion: "Android 7.0+ (Nougat, API 24)",
  minSdk: 24,
  releaseDate: "2026-11-19",
  fileSizeBytes: 91131319,
  fileSizeLabel: "91.1 MB",
  sha256: "410ad0616e2413ed9333423a4ef8f09c953167bb5e3c285a9f59ca589220a896",
  supportEmail: "support@cradlewellnessliving.com",
  supportDestinationLabel: "Branch Front Desk CRM or Operations Center",
};

const UNAVAILABLE_RELEASE: DriverApkPublicReleaseInfo = {
  ...AVAILABLE_RELEASE,
  available: false,
  statusLabel: "Not yet available",
  unavailableReason: "Google Drive APK download link is not configured.",
  packageId: null,
  versionName: null,
  versionCode: null,
  releaseDate: null,
  fileSizeBytes: null,
  fileSizeLabel: null,
  sha256: null,
};

describe("DriverAppDownloadDestination UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Android release card, Download for Android button, and Chrome install instructions when available", async () => {
    const driveUrl = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        downloadUrl: driveUrl,
        fileName: "CradleHub-Driver-v1.0.0.apk",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onNavigate = vi.fn();

    render(
      <DriverAppDownloadDestination
        release={AVAILABLE_RELEASE}
        backHref="/staff/driver/more"
        initialIsIos={false}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByRole("heading", { name: "CradleHub Driver" })).toBeTruthy();
    expect(screen.getByTestId("driver-app-version-line").textContent).toContain("Version 1.0.0");
    expect(screen.getByTestId("driver-app-version-line").textContent).toContain("91.1 MB");
    expect(screen.getByTestId("driver-app-install-instructions").textContent).toContain("Allow from this source");

    const btn = screen.getByTestId("driver-app-download-button");
    expect(btn.textContent).toContain("Download for Android");

    fireEvent.click(btn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/staff/driver/apk-download",
        expect.objectContaining({ method: "POST" })
      );
      expect(onNavigate).toHaveBeenCalledWith(driveUrl);
    });
    expect(screen.getByTestId("driver-app-issued-notice").textContent).toContain(
      "CradleHub-Driver-v1.0.0.apk"
    );
  });

  it("renders unavailable state cleanly when disabled or missing Google Drive URL", () => {
    render(
      <DriverAppDownloadDestination
        release={UNAVAILABLE_RELEASE}
        backHref="/driver"
        initialIsIos={false}
      />
    );

    expect(screen.queryByTestId("driver-app-download-button")).toBeNull();
    expect(screen.getByTestId("driver-app-unavailable-notice").textContent).toContain(
      "Google Drive APK download link is not configured."
    );
  });

  it("does not offer Android APK download on iPhone / iOS and shows Web Driver Portal fallback", () => {
    render(
      <DriverAppDownloadDestination
        release={AVAILABLE_RELEASE}
        backHref="/staff/driver/more"
        initialIsIos={true}
      />
    );

    expect(screen.queryByTestId("driver-app-download-button")).toBeNull();
    expect(screen.queryByTestId("driver-app-install-instructions")).toBeNull();
    expect(screen.getByTestId("driver-app-ios-notice").textContent).toContain(
      "not compatible with iPhone / iOS"
    );
    const fallbackLink = screen.getByTestId("driver-app-ios-web-fallback");
    expect(fallbackLink.getAttribute("href")).toBe("/staff/driver/more");
  });

  it("rejects non-Google-Drive URLs returned by a faulty server response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        downloadUrl: "https://evil.example/malware.apk",
        fileName: "malware.apk",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onNavigate = vi.fn();

    render(
      <DriverAppDownloadDestination
        release={AVAILABLE_RELEASE}
        backHref="/driver"
        initialIsIos={false}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByTestId("driver-app-download-button"));

    await waitFor(() => {
      expect(screen.getByTestId("driver-app-error-alert")).toBeTruthy();
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
