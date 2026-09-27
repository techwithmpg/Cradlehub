"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { StaffInstallGuide } from "./install-guide";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function StaffInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone === true);
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // 3. Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Do not show if already running installed/standalone or dismissed by user
  if (isStandalone || isInstalled || isDismissed) {
    return null;
  }

  // Only show if we either have a real deferred prompt (Android/Chromium) OR it's an iOS device in browser
  const canShowPrompt = Boolean(deferredPrompt || isIOS);
  if (!canShowPrompt) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      // Trigger real browser install prompt
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      // Show iOS step-by-step guidance dialog
      setShowGuide(true);
    }
  }

  return (
    <>
      <div
        role="complementary"
        aria-label="App installation banner"
        className="mx-4 my-2 flex items-center justify-between gap-3 rounded-2xl border border-[#C8A96B]/40 bg-[#FFFDF9] p-3.5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] shadow-xs">
            <Download size={20} aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#1E293B]">
              Install Cradle Hub
            </span>
            <span className="text-[11px] text-[#64748B]">
              Team Workspace — Operational phone access
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleInstallClick}
            className="rounded-xl bg-[#163A2B] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition active:scale-95 hover:bg-[#10261D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
          >
            {isIOS ? "How to Add" : "Install"}
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss installation prompt"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <StaffInstallGuide
        open={showGuide}
        onClose={() => setShowGuide(false)}
        isIOS={isIOS}
      />
    </>
  );
}
