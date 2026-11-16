/**
 * Which pages can be opened WITHOUT logging in.
 * Everything else requires login. (Public forms will be added here in Phase 4.)
 */
const PUBLIC_PATHS = ["/login"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * After login we send people back to the page they originally asked for.
 * Only allow addresses inside this app — never another website
 * (otherwise a crafted link could bounce someone to a fake site after login).
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\r\n\t]/.test(next)) return "/";
  if (isPublicPath(next.split("?")[0])) return "/";
  return next;
}
