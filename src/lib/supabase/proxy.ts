import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { isPublicPath } from "@/lib/auth/paths";

/**
 * Runs before every page request:
 * 1. Refreshes the login session cookie if needed.
 * 2. Sends anyone who isn't logged in to /login (except public pages).
 */
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });
  let extraHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          extraHeaders = { ...extraHeaders, ...headers };
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Verifies the login token. Do not put other code between creating the
  // client and this call (Supabase's guidance, avoids random log-outs).
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed session cookies and no-cache headers.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    Object.entries(extraHeaders).forEach(([k, v]) => redirect.headers.set(k, v));
    return redirect;
  };

  if (!isLoggedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(url);
  }

  if (isLoggedIn && pathname === "/login") {
    // A login token can still look valid after the account was removed or
    // deactivated. Double-check with Supabase before sending the person on;
    // otherwise clear the stale login, so the login page shows (no redirect loop).
    const deactivated = request.nextUrl.searchParams.has("error");
    const { data: verified } = deactivated ? { data: { user: null } } : await supabase.auth.getUser();
    if (!verified.user) {
      await supabase.auth.signOut({ scope: "local" });
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectTo(url);
  }

  return response;
}
