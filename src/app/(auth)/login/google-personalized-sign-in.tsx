"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { completeGoogleLoginAction } from "./actions";

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_ERROR_MESSAGE =
  "Google sign-in could not be completed. Try again or use your email and password.";
const LAST_AUTH_METHOD_KEY = "cradlehub:last-auth-method";

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleButtonConfiguration = {
  type: "standard";
  theme: "outline";
  size: "large";
  text: "continue_with";
  shape: "rectangular";
  logo_alignment: "left";
  width: number;
};

type GoogleIdApi = {
  initialize: (configuration: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode: "popup";
    context: "signin";
    auto_select: false;
    use_fedcm_for_button: true;
  }) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
};

type GoogleIdentityWindow = Window &
  typeof globalThis & {
    google?: {
      accounts?: {
        id?: GoogleIdApi;
      };
    };
    __cradleGoogleIdentityPromise?: Promise<void>;
  };

declare global {
  interface Window {
    __cradleGoogleIdentityPromise?: Promise<void>;
  }
}

function getGoogleIdentityWindow(): GoogleIdentityWindow {
  return window as GoogleIdentityWindow;
}

function getGoogleIdApi(): GoogleIdApi | null {
  return getGoogleIdentityWindow().google?.accounts?.id ?? null;
}

function loadGoogleIdentityScript(): Promise<void> {
  if (getGoogleIdApi()) return Promise.resolve();
  const googleWindow = getGoogleIdentityWindow();
  if (googleWindow.__cradleGoogleIdentityPromise) return googleWindow.__cradleGoogleIdentityPromise;

  googleWindow.__cradleGoogleIdentityPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Identity Services failed to load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google Identity Services failed to load.")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return googleWindow.__cradleGoogleIdentityPromise;
}

function getButtonWidth(container: HTMLElement): number {
  const availableWidth = container.clientWidth;
  return Math.max(200, Math.min(availableWidth, 400));
}

type GooglePersonalizedSignInProps = {
  clientId: string;
  onError: (message: string | null) => void;
};

export function GooglePersonalizedSignIn({
  clientId,
  onError,
}: GooglePersonalizedSignInProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedWidthRef = useRef(0);
  const authInFlightRef = useRef(false);
  const transitionStartedRef = useRef(false);
  const mountedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLastUsed, setShowLastUsed] = useState(false);
  const [usableWidth, setUsableWidth] = useState(0);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (authInFlightRef.current || transitionStartedRef.current) return;

      onError(null);

      if (!response.credential) {
        onError(GOOGLE_ERROR_MESSAGE);
        return;
      }

      authInFlightRef.current = true;
      setIsProcessing(true);

      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
        });

        if (error) throw error;

        window.localStorage.setItem(LAST_AUTH_METHOD_KEY, "google");

        const result = await completeGoogleLoginAction();
        if (!result.ok) {
          throw new Error(result.error);
        }

        transitionStartedRef.current = true;
        router.replace(result.redirectTo);
        router.refresh();
      } catch {
        if (!transitionStartedRef.current && mountedRef.current) {
          authInFlightRef.current = false;
          setIsProcessing(false);
          onError(GOOGLE_ERROR_MESSAGE);
        }
      }
    },
    [onError, router]
  );

  useEffect(() => {
    mountedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      if (mountedRef.current) {
        setShowLastUsed(window.localStorage.getItem(LAST_AUTH_METHOD_KEY) === "google");
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    async function initialize() {
      try {
        await loadGoogleIdentityScript();
        if (cancelled) return;

        const googleId = getGoogleIdApi();
        const container = containerRef.current;
        const button = buttonRef.current;

        if (!googleId || !container || !button) {
          throw new Error("Google Identity Services is unavailable.");
        }

        googleId.initialize({
          client_id: clientId,
          callback: handleCredential,
          ux_mode: "popup",
          context: "signin",
          auto_select: false,
          use_fedcm_for_button: true,
        });

        const renderButton = () => {
          if (cancelled || !buttonRef.current || !containerRef.current) return;

          const nextWidth = getButtonWidth(containerRef.current);
          setUsableWidth(containerRef.current.clientWidth);

          if (
            lastRenderedWidthRef.current > 0 &&
            Math.abs(nextWidth - lastRenderedWidthRef.current) < 8
          ) {
            return;
          }

          lastRenderedWidthRef.current = nextWidth;
          buttonRef.current.replaceChildren();
          googleId.renderButton(buttonRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: nextWidth,
          });

          setIsReady(true);
        };

        renderButton();

        observer = new ResizeObserver(renderButton);
        observer.observe(container);
      } catch {
        if (!cancelled) {
          setIsUnavailable(true);
          setIsReady(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [clientId, handleCredential]);

  if (isUnavailable) {
    return (
      <div className="flex h-11 items-center justify-center rounded-lg border border-[#F0ECE5] bg-[#FAF8F5] px-3 text-center text-[12px] text-[#8F8074]">
        Google sign-in is unavailable
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-11 w-full items-center justify-center"
      aria-busy={!isReady || isProcessing}
      aria-live="polite"
    >
      {!isReady ? (
        <div className="absolute inset-0 flex h-11 items-center justify-center rounded-lg border border-[#EFE8E0] bg-[#FAF8F5]">
          <span className="h-3 w-36 animate-pulse rounded-full bg-[#E7DDD2]" />
        </div>
      ) : null}

      <div
        ref={buttonRef}
        className={isProcessing ? "pointer-events-none opacity-60" : undefined}
      />

      {showLastUsed && usableWidth >= 360 ? (
        <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[#8A6F48] shadow-sm min-[380px]:inline-flex">
          Last used
        </span>
      ) : null}

      {isProcessing ? (
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/90 p-1 shadow-sm">
          <Loader2 className="size-3.5 animate-spin text-[#8A6F48]" aria-hidden="true" />
          <span className="sr-only">Completing Google sign-in</span>
        </span>
      ) : null}
    </div>
  );
}
