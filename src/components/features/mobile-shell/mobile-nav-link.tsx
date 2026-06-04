"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { useMobileNavigationProgress } from "./mobile-navigation-progress-provider";

type MobileNavLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

function hasProtocol(href: string) {
  return /^[a-z][a-z\d+\-.]*:/i.test(href);
}

function getHrefPathname(href: LinkProps["href"]) {
  if (typeof href === "string") {
    if (href.startsWith("#") || (hasProtocol(href) && !href.startsWith("/"))) {
      return null;
    }

    const pathWithoutHash = href.split("#")[0] ?? "";
    const pathname = pathWithoutHash.split("?")[0] ?? "";
    return pathname || null;
  }

  if (typeof href === "object" && href && "pathname" in href) {
    return typeof href.pathname === "string" ? href.pathname : null;
  }

  return null;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function MobileNavLink({
  children,
  href,
  onClick,
  target,
  ...props
}: MobileNavLinkProps) {
  const pathname = usePathname();
  const { startNavigation } = useMobileNavigationProgress();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented || isModifiedClick(event) || (target && target !== "_self")) {
      return;
    }

    const targetPathname = getHrefPathname(href);

    if (!targetPathname || targetPathname === pathname) {
      return;
    }

    startNavigation();
  }

  return (
    <Link href={href} target={target} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
