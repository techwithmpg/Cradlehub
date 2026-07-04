export type DeviceClientHints = {
  label: string;
  browserName: string | null;
  browserVersion: string | null;
  platformName: string | null;
};

function matchVersion(userAgent: string, pattern: RegExp): string | null {
  const match = userAgent.match(pattern);
  return match?.[1] ?? null;
}

function detectBrowser(userAgent: string): Pick<DeviceClientHints, "browserName" | "browserVersion"> {
  if (/Edg\//.test(userAgent)) {
    return { browserName: "Microsoft Edge", browserVersion: matchVersion(userAgent, /Edg\/([\d.]+)/) };
  }
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) {
    return { browserName: "Chrome", browserVersion: matchVersion(userAgent, /Chrome\/([\d.]+)/) };
  }
  if (/CriOS\//.test(userAgent)) {
    return { browserName: "Chrome", browserVersion: matchVersion(userAgent, /CriOS\/([\d.]+)/) };
  }
  if (/Firefox\//.test(userAgent)) {
    return { browserName: "Firefox", browserVersion: matchVersion(userAgent, /Firefox\/([\d.]+)/) };
  }
  if (/Safari\//.test(userAgent)) {
    return { browserName: "Safari", browserVersion: matchVersion(userAgent, /Version\/([\d.]+)/) };
  }
  return { browserName: null, browserVersion: null };
}

function detectPlatform(userAgent: string): string | null {
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return null;
}

export function inferDeviceClientHints(userAgent: string | null | undefined): DeviceClientHints {
  const safeUserAgent = userAgent ?? "";
  const browser = detectBrowser(safeUserAgent);
  const platformName = detectPlatform(safeUserAgent);
  const label = [platformName, browser.browserName].filter(Boolean).join(" - ") || "Attendance device";

  return {
    label,
    browserName: browser.browserName,
    browserVersion: browser.browserVersion,
    platformName,
  };
}

export function displayDeviceLabel(label: string | null | undefined, platformName?: string | null): string {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  return platformName ? `${platformName} device` : "Attendance device";
}

export function formatDeviceReason(value: string): string {
  return value.replaceAll("_", " ");
}
