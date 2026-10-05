import { NextResponse, type NextRequest } from "next/server";

/** One fresh request nonce; never trust a caller-supplied path, CSP or nonce. */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";

  const policy = [
    "default-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'", "img-src 'self' data: blob:", "font-src 'self'",
    "frame-src 'self'", "worker-src 'self'", "manifest-src 'self'",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("content-security-policy", policy);
  headers.set("x-sceneaxi-route", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
