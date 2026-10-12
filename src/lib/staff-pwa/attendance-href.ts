/** Keep supported attendance destinations inside the installed Staff scope. */
export function staffPwaAttendanceHref(href: string): string {
  const mappings: readonly [string, string][] = [
    ["/staff-portal/profile", "/staff/profile"],
    ["/staff-portal/attendance", "/staff/attendance"],
    ["/staff-portal/schedule", "/staff/schedule"],
  ];
  for (const [legacy, canonical] of mappings) {
    if (href === legacy || href.startsWith(`${legacy}#`) || href.startsWith(`${legacy}?`)) {
      return `${canonical}${href.slice(legacy.length)}`;
    }
  }
  return href;
}
