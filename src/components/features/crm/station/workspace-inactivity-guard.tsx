"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, LogOut, ShieldAlert, UserCheck, KeyRound, Monitor } from "lucide-react";

const SOFT_LOCK_MS = 15 * 60 * 1000; // 15 minutes idle -> in-place screen lock
const HARD_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours idle -> full sign-out with returnTo
const STORAGE_LAST_ACTIVE_KEY = "cradlehub:last_active_ts";
const STORAGE_LOCKED_KEY = "cradlehub:workspace_soft_locked";

export function WorkspaceInactivityGuard({
  userEmail,
  displayName,
  role,
}: {
  userEmail?: string | null;
  displayName: string;
  role: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Cradle Live (/crm/live-operations) is a live floor monitor and NEVER locks on inactivity
  const isLiveBoardExempt = useMemo(() => {
    return (
      pathname.startsWith("/crm/live-operations") ||
      pathname.startsWith("/manager/live-operations")
    );
  }, [pathname]);

  const [isSoftLocked, setIsSoftLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [emailInput, setEmailInput] = useState(userEmail ?? "");
  const [switchOperatorMode, setSwitchOperatorMode] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    if (userEmail && !emailInput) {
      setEmailInput(userEmail);
    }
  }, [userEmail, emailInput]);

  // Restore lock state if page was refreshed while locked
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLiveBoardExempt) {
      setIsSoftLocked(false);
      return;
    }
    const persistedLock = window.sessionStorage.getItem(STORAGE_LOCKED_KEY);
    if (persistedLock === "1") {
      setIsSoftLocked(true);
    }
  }, [isLiveBoardExempt]);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      window.localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const triggerHardSignOut = useCallback(async () => {
    const currentFullUrl =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    try {
      window.sessionStorage.removeItem(STORAGE_LOCKED_KEY);
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.replace(`/login?returnTo=${encodeURIComponent(currentFullUrl)}`);
  }, [pathname, router, searchParams, supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const events = ["mousedown", "keydown", "touchstart", "scroll", "click"];
    const onUserEvent = () => {
      if (!isSoftLocked) {
        recordActivity();
      }
    };

    events.forEach((ev) => window.addEventListener(ev, onUserEvent, { passive: true }));

    // Also allow manual lock shortcut (Alt + L) for receptionists stepping away
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "l" && !isLiveBoardExempt) {
        e.preventDefault();
        window.sessionStorage.setItem(STORAGE_LOCKED_KEY, "1");
        setIsSoftLocked(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const interval = window.setInterval(() => {
      if (isLiveBoardExempt) return;

      const storedTs = Number(window.localStorage.getItem(STORAGE_LAST_ACTIVE_KEY) || 0);
      const lastActive = Math.max(lastActivityRef.current, storedTs);
      const idleMs = Date.now() - lastActive;

      if (idleMs >= HARD_EXPIRY_MS) {
        void triggerHardSignOut();
      } else if (idleMs >= SOFT_LOCK_MS && !isSoftLocked) {
        window.sessionStorage.setItem(STORAGE_LOCKED_KEY, "1");
        setIsSoftLocked(true);
      }
    }, 15_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserEvent));
      window.removeEventListener("keydown", onKeyDown);
      window.clearInterval(interval);
    };
  }, [isLiveBoardExempt, isSoftLocked, recordActivity, triggerHardSignOut]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Enter your password to unlock the workspace.");
      return;
    }

    setUnlocking(true);
    setError(null);
    try {
      let targetEmail = emailInput.trim();
      if (!targetEmail) {
        const { data: userRes } = await supabase.auth.getUser();
        targetEmail = userRes.user?.email ?? "";
      }
      if (!targetEmail) {
        setError("Enter your email address to verify your session.");
        setSwitchOperatorMode(true);
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (signInErr) {
        setError("Incorrect password. Please try again.");
        return;
      }

      window.sessionStorage.removeItem(STORAGE_LOCKED_KEY);
      setPassword("");
      recordActivity();
      setIsSoftLocked(false);

      if (switchOperatorMode) {
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not verify credentials.");
    } finally {
      setUnlocking(false);
    }
  };

  if (!isSoftLocked || isLiveBoardExempt) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Locked due to Inactivity"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#12261E]/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#D8E4DC] bg-white shadow-2xl">
        <div className="border-b border-[#EFEAE4] bg-[#FAF8F5] px-6 py-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">
              <Lock className="size-3.5" />
              Session Locked (Inactivity)
            </span>
            <span className="text-[11px] font-semibold text-[#786D61] capitalize">
              {role.replace(/_/g, " ")} Workspace
            </span>
          </div>
          <h2 className="mt-3 text-lg font-bold text-[#1E1916]">
            {switchOperatorMode ? "Switch Station Operator" : `Resume Session — ${displayName}`}
          </h2>
          <p className="mt-1 text-xs text-[#6B5D52]">
            Your exact screen, open tabs, and unsaved work are preserved underneath. Unlock to continue right where you left off.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4 p-6">
          {switchOperatorMode ? (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#625A54]">
                Incoming Operator Email
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="operator@cradlespa.com"
                className="h-11 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm text-[#1E1916] outline-none focus:border-[#164B36]"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#625A54]">
              Password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9C8878]" />
              <input
                type="password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to resume..."
                className="h-11 w-full rounded-xl border border-[#DCD4CA] bg-white pl-9 pr-3 text-sm text-[#1E1916] outline-none focus:border-[#164B36]"
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={unlocking}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#164B36] text-sm font-bold text-white transition hover:bg-[#113A2A] disabled:opacity-50"
            >
              <UserCheck className="size-4" />
              {unlocking
                ? "Verifying…"
                : switchOperatorMode
                  ? "Sign In & Take Over Station"
                  : "Unlock & Resume Where I Left Off"}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSwitchOperatorMode((prev) => !prev);
                  setError(null);
                }}
                className="font-semibold text-[#164B36] hover:underline"
              >
                {switchOperatorMode
                  ? `Back to ${displayName}`
                  : "Different CRM Staff? Switch Operator"}
              </button>

              <button
                type="button"
                onClick={() => void triggerHardSignOut()}
                className="inline-flex items-center gap-1 font-semibold text-[#786D61] hover:text-red-700"
              >
                <LogOut className="size-3.5" />
                Full Sign Out
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
