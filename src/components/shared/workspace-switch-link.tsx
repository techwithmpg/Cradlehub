"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WorkspaceSwitchingLoader } from "./workspace-switching-loader";

type WorkspaceSwitchLinkProps = {
  href: string;
  label: string;
  loadingLabel?: string;
  children: ReactNode;
  className?: string;
};

export function WorkspaceSwitchLink({
  href,
  label,
  loadingLabel,
  children,
  className,
}: WorkspaceSwitchLinkProps) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    if (isSwitching) return;

    setIsSwitching(true);

    try {
      router.push(href);
      fallbackTimerRef.current = window.setTimeout(() => {
        setIsSwitching(false);
      }, 15000);
    } catch {
      setIsSwitching(false);
      toast.error("Workspace switch failed. Please try again.");
    }
  }

  return (
    <>
      <a
        aria-disabled={isSwitching}
        aria-label={label}
        className={cn(isSwitching && "pointer-events-none opacity-70", className)}
        href={href}
        onClick={handleClick}
      >
        {children}
      </a>
      {isSwitching ? (
        <WorkspaceSwitchingLoader subtitle={loadingLabel ?? "Preparing your workspace..."} />
      ) : null}
    </>
  );
}
