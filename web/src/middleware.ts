import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes Supabase auth cookies on each request.
 * Add matchers later to protect /app routes; legacy HTML in /public stays as-is.
 */
export async function middleware(request: NextRequest) {
  // Temporary Cloudflare-safe pass-through.
  // We can restore Supabase cookie refresh once platform runtime issue is cleared.
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    /*
     * Skip static assets, images, legacy html in public, and favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html)$).*)",
  ],
};
