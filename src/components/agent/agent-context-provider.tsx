"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { AgentSessionContext, AgentWorkspace } from "@/lib/agents/types";

type PageState = AgentSessionContext["pageState"];

export type AgentCoachContextValue = {
  context: AgentSessionContext;
  setPageState: (state: PageState) => void;
  setPageHint: (hint: string) => void;
  addFrictionSignal: (signal: string) => void;
  isIdle: boolean;
};

const AgentCoachContext = React.createContext<AgentCoachContextValue | null>(null);

export function useAgentCoachContext() {
  const ctx = React.useContext(AgentCoachContext);
  if (!ctx) {
    throw new Error("useAgentCoachContext must be used within AgentCoachProvider");
  }
  return ctx;
}

const IDLE_TIMEOUT_MS = 45_000;

export function AgentCoachProvider({
  workspace,
  role,
  branchId,
  branchName,
  userId,
  children,
}: {
  workspace: AgentWorkspace;
  role: string;
  branchId: string;
  branchName: string;
  userId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pageState, setPageState] = React.useState<PageState>("idle");
  const [pageHint, setPageHint] = React.useState<string>("");
  const [frictionSignals, setFrictionSignals] = React.useState<string[]>([]);
  const [isIdle, setIsIdle] = React.useState(false);
  const isIdleRef = React.useRef(false);
  const idleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setIdleState = React.useCallback((nextIdle: boolean) => {
    if (isIdleRef.current === nextIdle) return;
    isIdleRef.current = nextIdle;
    setIsIdle(nextIdle);
  }, []);

  React.useEffect(() => {
    const clearIdleTimeout = () => {
      if (!idleTimeoutRef.current) return;
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    };

    const scheduleIdleTimeout = () => {
      clearIdleTimeout();
      idleTimeoutRef.current = setTimeout(() => setIdleState(true), IDLE_TIMEOUT_MS);
    };

    const resetIdle = () => {
      setIdleState(false);
      scheduleIdleTimeout();
    };

    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);
    window.addEventListener("click", resetIdle);
    window.addEventListener("scroll", resetIdle);
    scheduleIdleTimeout();

    return () => {
      clearIdleTimeout();
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("click", resetIdle);
      window.removeEventListener("scroll", resetIdle);
    };
  }, [setIdleState]);

  const addFrictionSignal = React.useCallback((signal: string) => {
    setFrictionSignals((prev) => {
      if (prev.includes(signal)) return prev;
      return [...prev.slice(-4), signal];
    });
  }, []);

  const context = React.useMemo<AgentSessionContext>(
    () => ({
      workspace,
      page: pathname,
      role,
      branchId,
      branchName,
      userId,
      pageState,
      pageHint,
      frictionSignals,
    }),
    [workspace, pathname, role, branchId, branchName, userId, pageState, pageHint, frictionSignals]
  );

  const value = React.useMemo<AgentCoachContextValue>(
    () => ({
      context,
      setPageState,
      setPageHint,
      addFrictionSignal,
      isIdle,
    }),
    [context, addFrictionSignal, isIdle]
  );

  return <AgentCoachContext.Provider value={value}>{children}</AgentCoachContext.Provider>;
}
