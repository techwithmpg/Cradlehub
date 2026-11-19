"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  HelpCircle,
  Info,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type { DriverApkPublicReleaseInfo } from "@/lib/driver/apk-distribution";
import { isIosBrowserClient } from "@/lib/driver/platform";

export function DriverAppDownloadEntryCard({
  href = "/staff/driver/app",
  available = false,
  versionName = null,
}: {
  href?: string;
  available?: boolean;
  versionName?: string | null;
}) {
  return (
    <Link
      href={href}
      data-testid="driver-app-download-entry"
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#e1e6da] bg-white px-4 py-3 text-left shadow-2xs transition hover:border-[#19563c]/40 focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d6e4dc] bg-[#eef5f0] text-[#19563c]">
          <Smartphone className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#163a2b]">Download Driver App</span>
            <span
              data-testid="driver-app-entry-status"
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                available
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {available ? `v${versionName ?? "Ready"}` : "Not yet available"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-[#65746b]">
            {available
              ? "Official Android app for assigned trips, navigation, and QR scanning"
              : "Android installer release pending activation"}
          </p>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-[#65746b]" aria-hidden="true" />
    </Link>
  );
}

const subscribePlatformNoop = () => () => {};

export function DriverAppDownloadDestination({
  release,
  backHref = "/staff/driver/more",
  initialIsIos = false,
  onNavigate,
}: {
  release: DriverApkPublicReleaseInfo;
  backHref?: string;
  initialIsIos?: boolean;
  onNavigate?: (url: string) => void;
}) {
  const clientIsIos = useSyncExternalStore(
    subscribePlatformNoop,
    isIosBrowserClient,
    () => initialIsIos
  );
  const isIos = initialIsIos || clientIsIos;
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issuedInfo, setIssuedInfo] = useState<{
    fileName: string;
    downloadUrl: string;
  } | null>(null);

  async function handleDownload() {
    if (isIos || !release.available || isRequesting) return;
    setIsRequesting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/staff/driver/apk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            downloadUrl?: string;
            fileName?: string;
            error?: string;
          }
        | null;

      if (
        !response.ok ||
        !payload?.ok ||
        !payload.downloadUrl ||
        !payload.downloadUrl.startsWith("https://drive.google.com/file/d/")
      ) {
        setErrorMessage(
          payload?.error ??
            "Could not authorize the Android download link. Verify your session and try again."
        );
        return;
      }

      setIssuedInfo({
        fileName: payload.fileName ?? "CradleHub-Driver.apk",
        downloadUrl: payload.downloadUrl,
      });

      if (onNavigate) {
        onNavigate(payload.downloadUrl);
      } else {
        window.location.assign(payload.downloadUrl);
      }
    } catch {
      setErrorMessage("Network error while authorizing the download. Reconnect and retry.");
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <div
      data-testid="driver-app-download-destination"
      className="mx-auto max-w-[560px] space-y-4 px-4 py-5"
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          href={backHref}
          className="text-xs font-semibold text-[#19563c] hover:underline"
        >
          ← Back to Driver workspace
        </Link>
        <span
          data-testid="driver-app-release-badge"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            isIos
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : release.available
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {isIos ? (
            <>
              <Info className="size-3.5" aria-hidden="true" />
              Android Only
            </>
          ) : release.available ? (
            <>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Available
            </>
          ) : (
            <>
              <AlertCircle className="size-3.5" aria-hidden="true" />
              Not yet available
            </>
          )}
        </span>
      </div>

      {/* Main Driver App Card */}
      <section className="rounded-2xl border border-[#e1e6da] bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={release.iconPath}
            alt={`${release.appName} icon`}
            width={60}
            height={60}
            className="size-15 shrink-0 rounded-2xl border border-[#e6dfd5] bg-[#163a2b] object-cover shadow-xs"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#163a2b]">{release.appName}</h1>
            {release.available && release.versionName ? (
              <p
                data-testid="driver-app-version-line"
                className="mt-0.5 text-xs font-semibold text-[#19563c]"
              >
                Version {release.versionName}
                {release.fileSizeLabel ? ` · ${release.fileSizeLabel}` : ""}
              </p>
            ) : null}
            <p className="mt-1 text-xs leading-4 text-[#65746b]">
              Native Android app for assigned trips, navigation, QR scanning and driver operations.
            </p>
          </div>
        </div>

        {/* Compact Release Metadata */}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#eee8dd] pt-4 text-xs">
          <div>
            <dt className="font-medium text-[#65746b]">Approved Version</dt>
            <dd
              data-testid="driver-app-version"
              className="mt-0.5 font-semibold text-[#163a2b]"
            >
              {release.available && release.versionName
                ? `Version ${release.versionName} (Build ${release.versionCode})`
                : "Not yet available"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#65746b]">Android Compatibility</dt>
            <dd
              data-testid="driver-app-min-android"
              className="mt-0.5 font-semibold text-[#163a2b]"
            >
              {release.minAndroidVersion}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#65746b]">Installer Size</dt>
            <dd
              data-testid="driver-app-file-size"
              className="mt-0.5 font-semibold text-[#163a2b]"
            >
              {release.available && release.fileSizeLabel
                ? release.fileSizeLabel
                : "Pending release"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#65746b]">Release Date</dt>
            <dd
              data-testid="driver-app-release-date"
              className="mt-0.5 font-semibold text-[#163a2b]"
            >
              {release.available && release.releaseDate
                ? release.releaseDate
                : "Pending activation"}
            </dd>
          </div>
        </dl>

        {release.available && release.sha256 ? (
          <div className="mt-3 rounded-lg bg-[#faf8f5] px-3 py-2 text-[11px] text-[#526358]">
            <span className="font-semibold text-[#163a2b]">SHA-256: </span>
            <code className="break-all font-mono">{release.sha256}</code>
          </div>
        ) : null}

        {/* Platform-Aware Action Area */}
        <div className="mt-5">
          {isIos ? (
            <div
              role="status"
              data-testid="driver-app-ios-notice"
              className="space-y-3 rounded-xl border border-[#d6e4dc] bg-[#f4f8f5] p-4 text-xs leading-5 text-[#163a2b]"
            >
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 size-4 shrink-0 text-[#19563c]" aria-hidden="true" />
                <div>
                  <p className="font-bold">Android app is not compatible with iPhone / iOS</p>
                  <p className="mt-1 text-[#455a4f]">
                    The native CradleHub Driver installer (.apk) works on Android devices only and
                    cannot be installed on iPhone or iPad. Please continue using the CradleHub
                    Driver Web Portal in your browser.
                  </p>
                </div>
              </div>
              <Link
                href={backHref}
                data-testid="driver-app-ios-web-fallback"
                className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#19563c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#144530]"
              >
                Continue to Web Driver Portal
              </Link>
            </div>
          ) : release.available ? (
            <button
              type="button"
              data-testid="driver-app-download-button"
              onClick={() => void handleDownload()}
              disabled={isRequesting}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#19563c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#144530] disabled:opacity-60"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Verifying session &amp; opening Google Drive…
                </>
              ) : (
                <>
                  <Download className="size-4" aria-hidden="true" />
                  Download for Android
                </>
              )}
            </button>
          ) : (
            <div
              role="status"
              data-testid="driver-app-unavailable-notice"
              className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs leading-5 text-amber-950"
            >
              <p className="font-bold">Driver APK download is not yet available</p>
              <p className="mt-1 text-amber-900">
                {release.unavailableReason ??
                  "The approved Android installer has not been published yet. Continue using the Driver Web Portal."}
              </p>
            </div>
          )}

          {errorMessage ? (
            <p
              role="alert"
              data-testid="driver-app-error-alert"
              className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {errorMessage}
            </p>
          ) : null}

          {issuedInfo && !isIos ? (
            <div
              data-testid="driver-app-issued-notice"
              className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
            >
              <span>
                Opening <strong>{issuedInfo.fileName}</strong> on Google Drive.
              </span>
              <a
                href={issuedInfo.downloadUrl}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#19563c] underline hover:no-underline"
              >
                Open link again
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </div>
          ) : null}
        </div>
      </section>

      {/* Android Installation Instructions (hidden on iOS) */}
      {!isIos ? (
        <section
          data-testid="driver-app-install-instructions"
          className="rounded-2xl border border-[#e1e6da] bg-white p-5 shadow-2xs"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[#163a2b]">
            <ShieldCheck className="size-4 text-[#19563c]" aria-hidden="true" />
            <h2>How to Install on Android</h2>
          </div>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-[#526358]">
            <li>
              Tap <strong>Download for Android</strong> above, then tap <strong>Download</strong>{" "}
              on Google Drive (tap <strong>Download anyway</strong> if Drive skips virus scan on
              large APK files).
            </li>
            <li>
              Once finished, tap the download notification or open Chrome menu (<strong>⋮</strong>)
              → <strong>Downloads</strong> and select the <code>.apk</code> file.
            </li>
            <li>
              If Android asks for permission, tap <strong>Settings</strong>, turn on{" "}
              <strong>Allow from this source</strong> for Chrome, then go back and tap{" "}
              <strong>Install</strong>.
            </li>
            <li>
              Open <strong>CradleHub Driver</strong>, sign in with your Driver account, and allow{" "}
              <strong>Location</strong> and <strong>Camera</strong> when prompted. Updating an
              existing official release keeps your signed-in session.
            </li>
          </ol>
        </section>
      ) : null}

      {/* Support Contact */}
      <section className="rounded-2xl border border-[#e1e6da] bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#163a2b]">
          <HelpCircle className="size-4 text-[#19563c]" aria-hidden="true" />
          <h2>Support &amp; Assistance</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#526358]">
          For installation help or account access issues, contact your{" "}
          <strong>{release.supportDestinationLabel}</strong> or email{" "}
          <a
            href={`mailto:${release.supportEmail}`}
            className="font-semibold text-[#19563c] underline hover:no-underline"
          >
            {release.supportEmail}
          </a>
          . You can always continue using the authenticated Driver Web Portal while installing or
          updating the Android app.
        </p>
      </section>
    </div>
  );
}
