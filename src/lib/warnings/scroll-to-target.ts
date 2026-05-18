/**
 * DOM helpers for warning action targets that operate on the current page.
 * Safe to call server-side (guarded by typeof window check).
 */

/** Smooth-scroll an element into view by id. */
export function scrollToElement(sectionId: string): void {
  if (typeof window === "undefined") return;
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Focus a form field (input, select, textarea, button) by id
 * and scroll it into view.
 */
export function focusElement(fieldId: string): void {
  if (typeof window === "undefined") return;
  const el = document.getElementById(fieldId) as HTMLElement | null;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Build a full href from a base path plus optional tab and extra query params.
 * Does not require a URL base — works with relative paths.
 */
export function buildHref(
  href: string,
  tab?: string,
  query?: Record<string, string>
): string {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      params.set(k, v);
    }
  }
  const qs = params.toString();
  return qs ? `${href}?${qs}` : href;
}
