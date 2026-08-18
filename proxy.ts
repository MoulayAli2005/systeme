import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID_HEADER = "x-request-id";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("nexora_session");

  if (!session && (pathname.startsWith("/app") || pathname.startsWith("/platform"))) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Stamp every request so logs, error payloads and client reports can be
  // correlated across the proxy, route handlers and background jobs.
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/platform/:path*", "/api/:path*"],
};
