import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes Supabase auth cookies on each request.
 * Add matchers later to protect /app routes; legacy HTML in /public stays as-is.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });

  if (!url || !key) {
    return response;
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Avoid mutating request cookies in edge runtimes; only set response cookies.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    await supabase.auth.getUser();
  } catch {
    // Never block page rendering if auth refresh fails on edge runtime.
    return NextResponse.next({ request });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Skip static assets, images, legacy html in public, and favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html)$).*)",
  ],
};
