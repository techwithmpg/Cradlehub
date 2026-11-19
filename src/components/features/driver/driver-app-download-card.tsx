"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  HelpCircle,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type { DriverApkPublicReleaseInfo } from "@/lib/driver/apk-distribution";

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
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              {available ? `v${versionName ?? "Ready"}` : "Not yet available"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-[#65746b]">
            {available
              ? "Official signed Android application for CradleHub drivers"
              : "Signed Android APK release pending certification"}
          </p>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-[#65746b]" aria-hidden="true" />
    </Link>
  );
}

export function DriverAppDownloadDestination({
  release,
  backHref = "/staff/driver/more",
}: {
  release: DriverApkPublicReleaseInfo;
  backHref?: string;
}) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issuedInfo, setIssuedInfo] = useState<{
    fileName: string;
    expiresInSeconds: number;
  } | null>(null);

  async function handleDownload() {
    if (!release.available || isRequesting) return;
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
            expiresInSeconds?: number;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.downloadUrl) {
        setErrorMessage(
          payload?.error ??
            "Could not generate a secure download link. Verify your session and try again."
        );
        return;
      }

      setIssuedInfo({
        fileName: payload.fileName ?? "cradlehub-driver.apk",
        expiresInSeconds: payload.expiresInSeconds ?? 300,
      });
      window.location.assign(payload.downloadUrl);
    } catch {
      setErrorMessage("Network error while requesting download link. Reconnect and retry.");
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <div
      data-testid="driver-app-download-destination"
      className="mx-auto max-w-[560px] space-y-4 px-4 py-5"
    >
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="text-xs font-semibold text-[#19563c] hover:underline"
        >
          ← Back to Driver workspace
        </Link>
        <span
          data-testid="driver-app-release-badge"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            release.available
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {release.available ? (
            <>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Approved Release Available
            </>
          ) : (
            <>
              <AlertCircle className="size-3.5" aria-hidden="true" />
              Not yet available
            </>
          )}
        </span>
      </div>

      {/* App Identity Header */}
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
            <p className="mt-0.5 text-xs text-[#65746b]">
              Official Android Native Navigation, Trips &amp; Attendance Companion
            </p>
          </div>
        </div>

        {/* Metadata Grid */}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#eee8dd] pt-4 text-xs">
          <div>
            <dt className="font-medium text-[#65746b]">Approved Version</dt>
            <dd
              data-testid="driver-app-version"
              className="mt-0.5 font-semibold text-[#163a2b]"
            >
              {release.available && release.versionName
                ? `${release.versionName} (Build ${release.versionCode})`
                : "Not yet available"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#65746b]">Minimum Android</dt>
            <dd
              data-testid="driver-app-min-android"
              className="mt-0.5 font-semibold text-[#163a2b]"
            >
              {release.minAndroidVersion}
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
                : "Pending release certification"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#65746b]">Package Identity</dt>
            <dd className="mt-0.5 truncate font-mono text-[11px] text-[#163a2b]">
              {release.packageId ?? "com.mpgtechnologies.cradlehub.driver"}
            </dd>
          </div>
        </dl>

        {release.available && release.sha256 ? (
          <div className="mt-3 rounded-lg bg-[#faf8f5] px-3 py-2 text-[11px] text-[#526358]">
            <span className="font-semibold text-[#163a2b]">SHA-256 Checksum: </span>
            <code className="break-all font-mono">{release.sha256}</code>
          </div>
        ) : null}

        {/* Action or Fail-Closed Not Yet Available Notice */}
        <div className="mt-5">
          {release.available ? (
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
                  Authorizing expiring download link…
                </>
              ) : (
                <>
                  <Download className="size-4" aria-hidden="true" />
                  Download Signed Driver APK (v{release.versionName})
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
                  "No approved release-signed APK has been published yet. Debug or uncertified builds are never distributed here."}
              </p>
            </div>
          )}

          {errorMessage ? (
            <p
              role="alert"
              className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {errorMessage}
            </p>
          ) : null}

          {issuedInfo ? (
            <p className="mt-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Secure download started for <strong>{issuedInfo.fileName}</strong> (link expires in{" "}
              {Math.round(issuedInfo.expiresInSeconds / 60)} minutes).
            </p>
          ) : null}
        </div>
      </section>

      {/* Installation & Update Instructions */}
      <section className="rounded-2xl border border-[#e1e6da] bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#163a2b]">
          <ShieldCheck className="size-4 text-[#19563c]" aria-hidden="true" />
          <h2>Installation &amp; Update Instructions</h2>
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-[#526358]">
          <li>
            Sign in on your Android phone (Android 7.0 or newer) with your assigned CradleHub
            Driver account.
          </li>
          <li>
            Tap <strong>Download Signed Driver APK</strong> above when an approved release is
            available. Each download link is server-authorized and expires after 5 minutes.
          </li>
          <li>
            Open the downloaded <code>.apk</code> file from your browser downloads notification. If
            prompted by Android, allow installation from your browser for this update.
          </li>
          <li>
            <strong>Updating an existing installation:</strong> Install directly over your existing
            CradleHub Driver app to preserve your encrypted session and local preferences. Do not
            install unverified or debug builds over an official release package.
          </li>
          <li>
            After opening the app, grant <strong>Location</strong> (While using the app) and{" "}
            <strong>Camera</strong> permissions so turn-by-turn navigation and attendance QR
            scanning function properly.
          </li>
        </ol>
      </section>

      {/* Support Contact */}
      <section className="rounded-2xl border border-[#e1e6da] bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#163a2b]">
          <HelpCircle className="size-4 text-[#19563c]" aria-hidden="true" />
          <h2>Support &amp; Assistance</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#526358]">
          For installation help, signing verification, or device enrollment issues, contact your{" "}
          <strong>{release.supportDestinationLabel}</strong> or email{" "}
          <a
            href={`mailto:${release.supportEmail}`}
            className="font-semibold text-[#19563c] underline hover:no-underline"
          >
            {release.supportEmail}
          </a>
          . While the native Android release is unavailable or being updated, continue using this
          authenticated Driver web workspace.
        </p>
      </section>
    </div>
  );
}
