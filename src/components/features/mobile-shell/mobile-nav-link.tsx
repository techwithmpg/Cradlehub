"use client";

import type { AnchorHTMLAttributes, MouseEvent, PointerEvent, ReactNode } from "react";
import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMobileNavigationProgress } from "./mobile-navigation-progress-provider";
import { emitMobileInstantNav } from "./mobile-retained-tab-host";

type MobileNavLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

function hasProtocol(href: string) {
  return /^[a-z][a-z\d+\-.]*:/i.test(href);
}

function getHrefString(href: LinkProps["href"]): string | null {
  if (typeof href === "string") {
    if (href.startsWith("#") || (hasProtocol(href) && !href.startsWith("/"))) {
      return null;
    }
    return href;
  }
  if (typeof href === "object" && href && "pathname" in href) {
    return typeof href.pathname === "string" ? href.pathname : null;
  }
  return null;
}

function getHrefPathname(href: LinkProps["href"]) {
  const raw = getHrefString(href);
  if (!raw) return null;
  const pathWithoutHash = raw.split("#")[0] ?? "";
  const pathname = pathWithoutHash.split("?")[0] ?? "";
  return pathname || null;
}

function isModifiedClick(event: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
}) {
  return Boolean(
    event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (event.button !== undefined && event.button !== 0)
  );
}

export function MobileNavLink({
  children,
  href,
  onClick,
  onPointerDown,
  target,
  ...props
}: MobileNavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { startNavigation } = useMobileNavigationProgress();

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    onPointerDown?.(event);
    if (event.defaultPrevented || isModifiedClick(event) || (target && target !== "_self")) {
      return;
    }
    const targetHref = getHrefString(href);
    const targetPathname = getHrefPathname(href);
    if (!targetHref || !targetPathname || targetPathname === pathname) {
      return;
    }
    try {
      router.prefetch(targetHref);
    } catch {
      // Best-effort prefetch
    }
    emitMobileInstantNav(targetHref);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented || isModifiedClick(event) || (target && target !== "_self")) {
      return;
    }

    const targetHref = getHrefString(href);
    const targetPathname = getHrefPathname(href);

    if (!targetPathname || targetPathname === pathname) {
      return;
    }

    if (targetHref) emitMobileInstantNav(targetHref);
    startNavigation();
  }

  return (
    <Link
      href={href}
      target={target}
      prefetch={true}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
}
